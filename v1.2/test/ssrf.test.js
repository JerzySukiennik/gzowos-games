import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, monitorPublicUrl, validatePublicHttpsUrl } from '../server/security/url.js';

test('SSRF guard rejects credentials, localhost and private IP ranges',async()=>{
  for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.2','169.254.169.254','::1','fd00::1'])assert.equal(isPrivateAddress(address),true);
  await assert.rejects(()=>validatePublicHttpsUrl('http://example.com'),/credential-free HTTPS/);
  await assert.rejects(()=>validatePublicHttpsUrl('https://localhost/game'),/not public/);
  await assert.rejects(()=>validatePublicHttpsUrl('https://game.example',{lookup:async()=>[{address:'10.0.0.2',family:4}]}),/blocked network/);
});

test('URL monitor validates every redirect target before fetching it',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return new Response('',{status:302,headers:{location:'https://internal.example/secret'}});};
  const lookup=async hostname=>[{address:hostname==='internal.example'?'192.168.0.2':'93.184.216.34',family:4}];
  await assert.rejects(()=>monitorPublicUrl('https://game.example',{testFetchImpl:fetchImpl,allowTestTransport:true,lookup}),/blocked network/);
  assert.equal(calls,1);
});
