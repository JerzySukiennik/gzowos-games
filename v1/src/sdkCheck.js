export async function runSdkCheck({url,gameId,createChallenge,getChallenge,timeoutMs=12000,platformOrigin=location.origin}){
  if(typeof createChallenge!=='function'||typeof getChallenge!=='function')return{passed:false,reason:'trusted-backend-required'};
  const popup=window.open('about:blank','_blank','popup,width=900,height=700');
  if(!popup)return{passed:false,reason:'popup-blocked'};
  let challenge;
  try{challenge=await createChallenge(gameId,url);}catch(error){try{popup.close();}catch{}return{passed:false,reason:'challenge-failed',error:error.message};}
  return new Promise(resolve=>{let settled=false,timer;const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',onMessage);try{popup.close();}catch{}resolve(result);};const onMessage=async event=>{if(event.source!==popup||event.origin!==challenge.origin)return;const message=event.data;if(message?.source!=='gzowos-games-sdk'||message.nonce!==challenge.nonce||message.type!=='ready'||message.payload?.protocol!==2)return;try{const status=await getChallenge(challenge.id);finish(status.status==='passed'?{passed:true,checkedAt:status.passedAt,origin:status.origin,challengeId:challenge.id}:{passed:false,reason:'server-not-passed'});}catch{finish({passed:false,reason:'status-failed'});}};window.addEventListener('message',onMessage);timer=setTimeout(()=>finish({passed:false,reason:'timeout'}),timeoutMs);popup.location.href=challenge.launchUrl;});
}
