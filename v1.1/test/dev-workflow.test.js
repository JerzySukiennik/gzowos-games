import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const dev=fs.readFileSync(new URL('../tools/dev.mjs',import.meta.url),'utf8');
test('default dev command wires Bowling v1.9 automatically and keeps dashboard-only mode',()=>{
  assert.equal(pkg.scripts.dev,'node tools/dev.mjs');
  assert.equal(pkg.scripts['dev:dashboard'],'vite --host 0.0.0.0');
  assert.match(dev,/Gzowo Bowling\/v1\.9/);
  assert.match(dev,/127\.0\.0\.1/);
  assert.match(dev,/8099/);
  assert.match(dev,/VITE_BOWLING_URL:bowlingUrl/);
});
test('dev orchestrator cleans child processes and server on termination',()=>{
  assert.match(dev,/process\.on\('SIGINT'/);
  assert.match(dev,/process\.on\('SIGTERM'/);
  assert.match(dev,/vite\.kill\('SIGTERM'\)/);
  assert.match(dev,/server\.close/);
});
