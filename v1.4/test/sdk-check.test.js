import test from 'node:test';
import assert from 'node:assert/strict';
import { runSdkCheck } from '../src/sdkCheck.js';

test('SDK check uses a backend-signed challenge and trusts only server pass state',async()=>{
  const oldWindow=globalThis.window,oldLocation=globalThis.location,listeners=new Set(),nonce='nonce-1234567890',popup={close(){},location:{set href(value){queueMicrotask(()=>listeners.forEach(listener=>listener({source:popup,origin:'https://game.example',data:{source:'gzowos-games-sdk',nonce,type:'ready',payload:{protocol:2}}})));}}};
  globalThis.location={origin:'https://deck.example'};globalThis.window={open:()=>popup,addEventListener:(type,listener)=>listeners.add(listener),removeEventListener:(type,listener)=>listeners.delete(listener)};
  try{const result=await runSdkCheck({url:'https://game.example/',gameId:'g1',createChallenge:async()=>({id:'c1',nonce,origin:'https://game.example',launchUrl:'https://game.example/#ggLaunch=signed'}),getChallenge:async()=>({status:'passed',origin:'https://game.example',passedAt:123})});assert.equal(result.passed,true);assert.equal(result.challengeId,'c1');}
  finally{globalThis.window=oldWindow;globalThis.location=oldLocation;}
});

test('SDK check cannot pass from popup ready when backend says pending',async()=>{
  const oldWindow=globalThis.window,oldLocation=globalThis.location,listeners=new Set(),popup={close(){},location:{set href(value){queueMicrotask(()=>listeners.forEach(listener=>listener({source:popup,origin:'https://game.example',data:{source:'gzowos-games-sdk',nonce:'nonce-1234567890',type:'ready',payload:{protocol:2}}})));}}};globalThis.location={origin:'https://deck.example'};globalThis.window={open:()=>popup,addEventListener:(type,listener)=>listeners.add(listener),removeEventListener:(type,listener)=>listeners.delete(listener)};
  try{assert.equal((await runSdkCheck({url:'https://game.example/',gameId:'g1',createChallenge:async()=>({id:'c1',nonce:'nonce-1234567890',origin:'https://game.example',launchUrl:'https://game.example/'}),getChallenge:async()=>({status:'pending'})})).passed,false);}finally{globalThis.window=oldWindow;globalThis.location=oldLocation;}
});
