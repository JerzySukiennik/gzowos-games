export function encodeLaunchToken(payload) {
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  let binary=''; bytes.forEach(byte=>binary+=String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeLaunchToken(token) {
  const payloadPart=token.includes('.')?token.split('.')[1]:token;
  const normalized=payloadPart.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(normalized); const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function buildLaunchUrl(rawUrl,token,base='https://games.example/') {
  const url=new URL(rawUrl,base); const fragment=new URLSearchParams(url.hash.slice(1));fragment.set('ggLaunch',token);url.hash=fragment.toString();return url.href;
}
export function validJoinPayload(payload) {
  return Boolean(payload?.sessionId && payload?.joinData && typeof payload.joinData==='object' && payload.permissions?.includes('session:join'));
}
