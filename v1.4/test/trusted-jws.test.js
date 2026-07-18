import test from 'node:test';
import assert from 'node:assert/strict';
import { createJwks, generateES256KeyPair, signES256, verifyES256 } from '../server/crypto/jws.js';
import { verifySignedLaunchToken } from '../sdk/src/index.js';

test('ES256 compact JWS verifies on server and in browser SDK verifier',async()=>{
  const key=await generateES256KeyPair({kid:'launch-2026-01'}),jwks=await createJwks([key]);
  const now=1_800_000_000,payload={iss:'https://games.example',aud:'https://game.example',v:2,sub:'u1',game:'g1',gameOrigin:'https://game.example',platformOrigin:'https://games.example',nonce:'nonce-1234567890',jti:'jti-1234567890123',iat:now,exp:now+180};
  const token=await signES256(payload,key);
  assert.deepEqual((await verifyES256(token,{jwks,now,issuer:payload.iss,audience:payload.aud})).payload,payload);
  const fetchImpl=async()=>new Response(JSON.stringify(jwks),{status:200,headers:{'content-type':'application/json'}});
  assert.deepEqual(await verifySignedLaunchToken(token,{jwksUrl:'https://games.example/.well-known/jwks.json',fetchImpl,now,issuer:payload.iss,audience:payload.aud}),payload);
  const parts=token.split('.'),tampered=`${parts[0]}.${parts[1].slice(0,-1)}A.${parts[2]}`;
  await assert.rejects(()=>verifyES256(tampered,{jwks,now}),/Invalid launch token signature|Unexpected token|JSON/);
});

test('JWS verifier rejects unknown key and tokens longer than five minutes',async()=>{
  const key=await generateES256KeyPair({kid:'one'}),other=await generateES256KeyPair({kid:'two'}),now=1_800_000_000;
  const token=await signES256({iat:now,exp:now+301},key);
  const otherJwks=await createJwks([other]),matchingJwks=await createJwks([key]);
  await assert.rejects(()=>verifyES256(token,{jwks:otherJwks,now}),/Unknown signing key/);
  await assert.rejects(()=>verifyES256(token,{jwks:matchingJwks,now}),/five minutes/);
});
