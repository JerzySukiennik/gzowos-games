import { createHash } from 'node:crypto';
import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist');
const versionPattern = /^v\d+(?:\.\d+)*$/;
const rootAbsoluteSdkPath = '/sdk/README.md';
const relativeSdkPath = './sdk/README.md';

function compareVersions(left, right) {
  const leftParts = left.slice(1).split('.').map(Number);
  const rightParts = right.slice(1).split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return left.localeCompare(right);
}

async function getVersionDirectories() {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && versionPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareVersions);
}

async function assertFile(filePath, label) {
  await access(filePath);
  const details = await stat(filePath);
  if (!details.isFile()) {
    throw new Error(`${label} is not a file: ${path.relative(projectRoot, filePath)}`);
  }
}

async function listFiles(directory, ignoredDirectories = new Set()) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath, ignoredDirectories));
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

async function hashSnapshot(directory) {
  const hash = createHash('sha256');
  const files = await listFiles(directory, new Set(['dist', 'node_modules']));

  for (const file of files) {
    hash.update(path.relative(directory, file));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }

  return hash.digest('hex');
}

async function normalizeSnapshotOutput(outputDirectory, label) {
  const textFiles = (await listFiles(outputDirectory))
    .filter((file) => ['.html', '.js'].includes(path.extname(file)));
  let replacements = 0;

  for (const file of textFiles) {
    const source = await readFile(file, 'utf8');
    const occurrences = source.split(rootAbsoluteSdkPath).length - 1;
    if (occurrences === 0) continue;
    await writeFile(file, source.split(rootAbsoluteSdkPath).join(relativeSdkPath));
    replacements += occurrences;
  }

  if (replacements === 0) {
    throw new Error(`${label} output did not contain the SDK documentation link`);
  }

  let relativeLinkFound = false;
  for (const file of textFiles) {
    const source = await readFile(file, 'utf8');
    relativeLinkFound ||= source.includes(relativeSdkPath);
    if (source.split(relativeSdkPath).join('').includes(rootAbsoluteSdkPath)) {
      throw new Error(`${label} output still contains a root-absolute SDK documentation link`);
    }
  }

  if (!relativeLinkFound) {
    throw new Error(`${label} output does not contain the relative SDK documentation link`);
  }

  console.log(`Normalized ${label}: ${replacements} SDK documentation link`);
}

function localAssetPaths(html) {
  const references = html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi);
  return [...references]
    .map(([, reference]) => reference)
    .filter((reference) => !/^(?:[a-z]+:|\/\/|#)/i.test(reference))
    .map((reference) => decodeURIComponent(reference.split(/[?#]/, 1)[0]))
    .filter(Boolean);
}

async function assertPageOutput(outputDirectory, label) {
  const indexPath = path.join(outputDirectory, 'index.html');
  await assertFile(indexPath, `${label} entry point`);

  const html = await readFile(indexPath, 'utf8');
  const referencedAssets = localAssetPaths(html);

  for (const assetReference of referencedAssets) {
    const assetPath = assetReference.startsWith('/')
      ? path.join(outputRoot, assetReference.replace(/^\/+/, ''))
      : path.resolve(outputDirectory, assetReference);
    await assertFile(assetPath, `${label} asset`);
  }

  console.log(`Verified ${label}: index.html and ${referencedAssets.length} local assets`);
}

async function buildTarget(root, outDir, emptyOutDir) {
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    build: {
      outDir,
      emptyOutDir
    }
  });
}

const versions = await getVersionDirectories();
const snapshotHashes = new Map();

for (const version of versions) {
  snapshotHashes.set(version, await hashSnapshot(path.join(projectRoot, version)));
}

await buildTarget(projectRoot, outputRoot, true);
await assertPageOutput(outputRoot, 'current release');

for (const version of versions) {
  const versionRoot = path.join(projectRoot, version);
  const versionOutput = path.join(outputRoot, version);

  await assertFile(path.join(versionRoot, 'index.html'), `${version} source entry point`);
  await assertFile(path.join(versionRoot, 'vite.config.js'), `${version} Vite config`);
  await buildTarget(versionRoot, versionOutput, true);
  await normalizeSnapshotOutput(versionOutput, version);
  await assertPageOutput(versionOutput, version);

  const sourceHash = await hashSnapshot(versionRoot);
  if (sourceHash !== snapshotHashes.get(version)) {
    throw new Error(`${version} source changed while building its deployment artifact`);
  }
  console.log(`Verified ${version} source integrity: ${sourceHash}`);
}

console.log(`GitHub Pages artifact ready: current release plus ${versions.length} version snapshots`);
