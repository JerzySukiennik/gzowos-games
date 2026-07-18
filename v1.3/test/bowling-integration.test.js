import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { encodeLaunchToken } from '../src/protocol.js';

const root='/Users/jurek/Downloads/Claude/Projects/Gzowo Bowling/v1.9';
// The Bowling checkout only exists on Jurek's machine; skip these tests elsewhere (CI).
const hasBowling=fs.existsSync(`${root}/js/gg-bridge.js`);
const bridge=hasBowling?await import(pathToFileURL(`${root}/js/gg-bridge.js`)):null;
test('Bowling v1.9 bridge parses a localhost-only v1 token and normalizes MILA route',{skip:!hasBowling},async()=>{
  const payload={v:1,game:'bowling',gameOrigin:'http://localhost:8089',platformOrigin:'http://localhost:4173',exp:Date.now()+60000,nonce:'local-nonce',permissions:['session:join'],sessionId:'bowl-mila-MILA',joinData:{room:'mila'}};
  const token=encodeLaunchToken(payload),launch=await bridge.parseGGLaunch(`?ggLaunch=${encodeURIComponent(token)}`,'http://localhost:8089');
  assert.equal(launch.active,true); assert.equal(launch.room,'MILA'); assert.equal(launch.payload.sessionId,'bowl-mila-MILA');
});
test('Bowling v1.9 loads bridge before routing and controller publishes after real join',{skip:!hasBowling},()=>{
  const html=fs.readFileSync(`${root}/index.html`,'utf8'),controller=fs.readFileSync(`${root}/js/controller/main.js`,'utf8');
  assert.ok(html.indexOf('await initGGBridge()') < html.indexOf('new URLSearchParams(location.search)'));
  assert.match(controller,/__ggBridge\?\.afterJoin/);
  assert.match(controller,/room: code, playerId: myId/);
});
test('immutable Bowling v1.8 has no GG bridge edits',{skip:!hasBowling},()=>{
  assert.equal(fs.existsSync('/Users/jurek/Downloads/Claude/Projects/Gzowo Bowling/v1.8/js/gg-bridge.js'),false);
  assert.doesNotMatch(fs.readFileSync('/Users/jurek/Downloads/Claude/Projects/Gzowo Bowling/v1.8/index.html','utf8'),/initGGBridge/);
});
