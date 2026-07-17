import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { games } from '../src/data.js';

test('entrypoint exposes required product surfaces', () => {
  const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  for(const surface of ['homeView','gamesView','friendsView','chatView','creatorView','adminView','settingsView','detailView']) assert.match(source,new RegExp(`function ${surface}`));
});
test('no secret values are committed in environment template',()=>{
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8');
  assert.doesNotMatch(env,/=\S+/);
});
test('seeded catalog uses real HTTPS game URLs and only SDK-integrated games can launch',()=>{
  assert.equal(new Set(games.map(game=>game.id)).size,games.length);
  games.forEach(game=>assert.equal(new URL(game.url).protocol,'https:'));
  assert.deepEqual(games.filter(game=>game.sdkReady).map(game=>game.id),['bowling']);
  assert.equal(games.find(game=>game.id==='bowling').url,'https://jerzysukiennik.github.io/gzowo-bowling/');
  assert.equal(games.find(game=>game.id==='pogo-world').url,'https://jerzysukiennik.github.io/pogo-world/');
});
