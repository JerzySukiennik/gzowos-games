import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createTokenAuthenticator } from '../server/auth.js';
import { generateES256KeyPair } from '../server/crypto/jws.js';
import { MemoryRepository } from '../server/repository/memory.js';

test('Firebase token adapter carries canonical email into real parent approval path',async()=>{
  const claims={child:{uid:'child'},parent:{uid:'parent',email:' Parent@Example.COM ',email_verified:true}},authenticate=createTokenAuthenticator({verifyIdToken:async token=>claims[token]}),repository=new MemoryRepository(),key=await generateES256KeyPair({kid:'auth'}),app=createApp({authenticate,repository,signingKey:key,issuer:'https://games.example',platformOrigin:'https://games.example',clock:()=>1_800_000_000_000});
  const call=(path,token,body={})=>app.fetch(new Request(`https://api.example${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal((await call('/v1/onboarding/age-band','child',{dateOfBirth:'2018-01-01',parentEmail:'parent@example.com'})).status,201);
  assert.equal((await call('/v1/parent-consents/child/approve','parent')).status,200);
  assert.equal(repository.parentConsents.get('child').status,'approved');
});
