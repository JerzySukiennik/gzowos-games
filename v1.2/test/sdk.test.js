import test from 'node:test';
import assert from 'node:assert/strict';
import { GzowoGamesSDK } from '../sdk/src/index.js';

test('SDK enforces session limit and emits transport messages', () => {
  const sent=[]; const sdk=new GzowoGamesSDK({gameId:'test',transport:{postMessage:(data)=>sent.push(data)}});
  assert.throws(()=>sdk.createSession({id:'x',maxPlayers:9}),/1–8/);
  assert.equal(sdk.createSession({id:'x',maxPlayers:8}).maxPlayers,8);
  assert.equal(sent[0].type,'session');
});
test('SDK requires a game ID',()=>assert.throws(()=>new GzowoGamesSDK(),/gameId/));
