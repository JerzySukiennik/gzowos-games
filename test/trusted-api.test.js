import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, deriveAgeBand } from '../server/app.js';
import { generateES256KeyPair, createJwks, verifyES256 } from '../server/crypto/jws.js';
import { MemoryRepository } from '../server/repository/memory.js';

const now=1_800_000_000_000;
async function fixture(){
  const key=await generateES256KeyPair({kid:'api-key'}),repository=new MemoryRepository({games:[{id:'bowling',url:'https://game.example/play',origin:'https://game.example',status:'published',visibility:'visible',sdkPassed:true,sdkHandshakeOrigin:'https://game.example',ageRating:'13+',permissions:['profile:basic','session:join']}],ageBands:{player:'13-17'},threads:[{id:'t1',members:['player','bad']}],messages:[{id:'m1',threadId:'t1',authorId:'bad',text:'evidence',kind:'session',createdAt:now-1000,expiresAt:now-1},{id:'m2',threadId:'t1',authorId:'ok',text:'delete',kind:'session',createdAt:now-1000,expiresAt:now-1}]});
  const authenticate=async request=>{const token=request.headers.get('authorization')?.replace('Bearer ','');if(token==='admin')return{uid:'admin',name:'Admin',admin:true};if(token==='player')return{uid:'player',name:'Player',admin:false};if(token==='newbie')return{uid:'newbie',name:'New',admin:false};throw Object.assign(new Error('bad token'),{status:401});};
  const setClaims=[];const app=createApp({authenticate,repository,signingKey:key,issuer:'https://games.example',platformOrigin:'https://games.example',clock:()=>now,testFetchImpl:async()=>new Response('<!doctype html>',{status:200,headers:{'content-type':'text/html'}}),lookup:async()=>[{address:'93.184.216.34',family:4}],adminBootstrap:{secret:'bootstrap-secret',allowedUids:['admin'],setAdminClaim:async(uid,enabled)=>setClaims.push({uid,enabled})}});
  return {app,key,repository};
}
const call=(app,path,{token='player',method='POST',body}={})=>app.fetch(new Request(`https://api.example${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));

test('launch route signs only trusted game, age and permission data',async()=>{
  const {app,key}=await fixture();
  const response=await call(app,'/v1/launch-tokens',{body:{gameId:'bowling',age:'18+',permissions:['profile:basic','admin:all'],joinData:{room:'ABCD'}}});
  assert.equal(response.status,200);const value=await response.json(),jwks=await createJwks([key]);
  const {payload}=await verifyES256(value.token,{jwks,now:Math.floor(now/1000),issuer:'https://games.example',audience:'https://game.example'});
  assert.equal(payload.age,'13-17');assert.deepEqual(payload.permissions,['profile:basic']);assert.equal(payload.v,2);
});

test('onboarding derives age and admin routes are role-gated',async()=>{
  const {app,repository}=await fixture();
  assert.equal(deriveAgeBand('2010-01-01',new Date('2026-07-16T00:00:00Z')),'13-17');
  const onboard=await call(app,'/v1/onboarding/age-band',{token:'newbie',body:{dateOfBirth:'2018-01-01',parentEmail:'parent@example.com'}});assert.equal(onboard.status,201);assert.equal(await repository.getAgeBand('newbie'),'U13');
  assert.equal((await call(app,'/v1/onboarding/age-band',{token:'newbie',body:{dateOfBirth:'2000-01-01',parentEmail:''}})).status,409);
  assert.equal((await call(app,'/v1/admin/age-bands/child',{method:'PUT',body:{ageBand:'U13'}})).status,403);
  assert.equal((await call(app,'/v1/admin/age-bands/child',{token:'admin',method:'PUT',body:{ageBand:'U13'}})).status,200);
});

test('reports preserve message evidence while cleanup removes other expired chat',async()=>{
  const {app,repository}=await fixture();
  const report=await call(app,'/v1/reports',{body:{targetKind:'message',targetId:'m1',reason:'Threat'}});assert.equal(report.status,201);assert.equal((await report.json()).evidencePreserved,true);
  const cleanup=await call(app,'/v1/admin/cleanup',{token:'admin',body:{}});assert.deepEqual(await cleanup.json(),{messagesDeleted:1,evidenceDeleted:0,gamesDeleted:0});
  assert.equal(repository.messages.has('m1'),true);assert.equal(repository.messages.has('m2'),false);
});
