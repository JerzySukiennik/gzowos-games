import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLaunchToken,decodeLaunchToken,buildLaunchUrl,validJoinPayload } from '../src/protocol.js';
import { GzowoGamesSDK } from '../sdk/src/index.js';

const payload={v:1,sub:'u1',name:'Jurek Ż',avatar:null,game:'bowling',gameOrigin:'https://game.example',platformOrigin:'https://deck.example',sessionId:'room-42',joinData:{lane:4},permissions:['profile:basic','session:join'],nonce:'n-42',party:['u1','u2'],age:'18+',exp:Date.now()+60000};
test('launch payload round-trips UTF-8 and builds a usable URL',()=>{
  const token=encodeLaunchToken(payload),decoded=decodeLaunchToken(token),url=new URL(buildLaunchUrl('https://game.example/play?mode=full',token));
  assert.deepEqual(decoded,payload);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('ggLaunch'),token);
  assert.equal(validJoinPayload(decoded),true);
});
test('SDK accepts approved origin and posts nonce-scoped ready to exact platform origin',async()=>{
  const oldLocation=globalThis.location,oldWindow=globalThis.window,oldChannel=globalThis.BroadcastChannel;
  const calls=[]; globalThis.location={origin:'http://localhost:8080',hostname:'localhost',search:'',hash:''}; globalThis.window={addEventListener(){},removeEventListener(){}}; globalThis.BroadcastChannel=undefined;
  const localPayload={...payload,gameOrigin:'http://localhost:8080'};
  try{const sdk=new GzowoGamesSDK({gameId:'bowling',allowUnsignedDev:true,transport:{postMessage:(message,origin)=>calls.push({message,origin})}});const launch=await sdk.init({launchToken:encodeLaunchToken(localPayload)});assert.equal(launch.sessionId,'room-42');assert.deepEqual(launch.joinData,{lane:4});assert.equal(calls[0].origin,'https://deck.example');assert.equal(calls[0].message.nonce,'n-42');}
  finally{globalThis.location=oldLocation;globalThis.window=oldWindow;globalThis.BroadcastChannel=oldChannel;}
});
test('SDK rejects a token approved for another game origin',async()=>{
  const oldLocation=globalThis.location;globalThis.location={origin:'http://localhost:8080',hostname:'localhost',search:'',hash:''};
  try{await assert.rejects(()=>new GzowoGamesSDK({gameId:'bowling',allowUnsignedDev:true}).init({launchToken:encodeLaunchToken(payload)}),/not approved/);}finally{globalThis.location=oldLocation;}
});
test('SDK rejects unsigned tokens unless localhost is explicitly enabled',async()=>{
  const oldLocation=globalThis.location;globalThis.location={origin:'https://game.example',hostname:'game.example',search:'',hash:''};
  try{await assert.rejects(()=>new GzowoGamesSDK({gameId:'bowling'}).init({launchToken:encodeLaunchToken(payload)}),/Unsigned GG launch tokens/);}finally{globalThis.location=oldLocation;}
});
