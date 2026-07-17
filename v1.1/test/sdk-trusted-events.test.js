import test from 'node:test';
import assert from 'node:assert/strict';
import { GzowoGamesSDK } from '../sdk/src/index.js';

test('trusted SDK events are delivered serially and one failure does not poison the queue',async()=>{
  const delivered=[],sdk=new GzowoGamesSDK({gameId:'g1',fetchImpl:async(url,options)=>{const event=JSON.parse(options.body);if(event.sequence===1){await new Promise(resolve=>setTimeout(resolve,15));delivered.push(event.sequence);throw new Error('temporary');}delivered.push(event.sequence);return new Response('',{status:202});}});sdk.eventChannelToken='channel';sdk.eventsUrl='https://games.example/v1/launches/events';sdk.eventSequence=0;
  const errors=[];sdk.on('error',error=>errors.push(error.message));const first=sdk.sendTrustedEvent('ready',{gameId:'g1',protocol:2}),second=sdk.sendTrustedEvent('presence',{gameId:'g1',status:'playing'});await Promise.all([first,second]);assert.deepEqual(delivered,[1,2]);assert.equal(errors.length,1);
});

test('closeSession queues a trusted leave event',async()=>{
  const events=[],sdk=new GzowoGamesSDK({gameId:'g1',transport:{postMessage(){}},fetchImpl:async(url,options)=>{events.push(JSON.parse(options.body));return new Response('',{status:202});}});sdk.eventChannelToken='channel';sdk.eventsUrl='https://games.example/v1/launches/events';sdk.eventSequence=0;sdk.session={id:'room-1'};sdk.closeSession();await sdk.eventQueue;assert.equal(sdk.session,null);assert.equal(events[0].type,'leave');assert.deepEqual(events[0].payload,{sessionId:'room-1'});
});
