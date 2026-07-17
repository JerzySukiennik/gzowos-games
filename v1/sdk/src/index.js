const EVENTS = ['ready', 'presence', 'session', 'leave', 'error'];
const jwksCache = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function decodePart(value) {
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid base64url encoding');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes=new Uint8Array(Array.from(binary, character => character.charCodeAt(0)));
  let canonical='';bytes.forEach(byte=>canonical+=String.fromCharCode(byte));canonical=btoa(canonical).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(canonical!==value)throw new Error('Non-canonical base64url encoding');
  return bytes;
}

function decodeJson(value) {
  return JSON.parse(decoder.decode(decodePart(value)));
}

function localHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

export function decodeLaunchToken(token) {
  try { return decodeJson(token.includes('.') ? token.split('.')[1] : token); }
  catch { throw new Error('Invalid GG launch token'); }
}

export function readLaunchToken(locationLike = globalThis.location) {
  return new URLSearchParams(String(locationLike?.hash || '').replace(/^#/, '')).get('ggLaunch');
}

async function loadJwks(url, fetchImpl, force = false) {
  const cached=jwksCache.get(url);
  if (!force&&cached&&Date.now()-cached.at<300_000)return cached.promise;
  const promise=fetchImpl(url, { headers: { accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' }).then(async response => {
    if (!response.ok) throw new Error('Unable to load GG signing keys');
    const value = await response.json();
    if (!Array.isArray(value?.keys)) throw new Error('Invalid GG signing keys');
    return value;
  }).catch(error => { jwksCache.delete(url);throw error; });
  jwksCache.set(url,{at:Date.now(),promise});
  return promise;
}

export async function verifySignedLaunchToken(token, { jwksUrl, fetchImpl = fetch, now = Math.floor(Date.now() / 1000), issuer, audience } = {}) {
  const parts = String(token).split('.');
  if (parts.length !== 3 || !jwksUrl) throw new Error('Signed GG launch token and jwksUrl are required');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if(decodePart(encodedSignature).length!==64)throw new Error('ES256 signature must be 64 bytes');
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (header.alg !== 'ES256' || !header.kid) throw new Error('Unsupported GG launch signature');
  let keys = await loadJwks(jwksUrl, fetchImpl);
  let jwk = keys.keys.find(key => key.kid === header.kid && key.alg === 'ES256' && key.use === 'sig');
  if(!jwk){keys=await loadJwks(jwksUrl,fetchImpl,true);jwk=keys.keys.find(key=>key.kid===header.kid&&key.alg==='ES256'&&key.use==='sig');}
  if (!jwk) throw new Error('Unknown GG signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decodePart(encodedSignature), encoder.encode(`${encodedHeader}.${encodedPayload}`));
  if (!valid) throw new Error('Invalid GG launch signature');
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= now || payload.iat > now + 30 || payload.exp - payload.iat > 300) throw new Error('GG launch token is expired or invalid');
  if (issuer && payload.iss !== issuer) throw new Error('GG launch issuer mismatch');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (audience && !audiences.includes(audience)) throw new Error('GG launch audience mismatch');
  if(typeof payload.jti!=='string'||payload.jti.length<16||typeof payload.nonce!=='string'||payload.nonce.length<16)throw new Error('GG launch identifiers are invalid');
  return payload;
}

export class GzowoGamesSDK {
  constructor({ gameId, parentOrigin = '*', jwksUrl, issuer,consumeUrl,eventsUrl, allowUnsignedDev = false, fetchImpl = globalThis.fetch, transport } = {}) {
    if (!gameId) throw new Error('gameId is required');
    this.gameId = gameId;
    this.parentOrigin = parentOrigin;
    this.jwksUrl = jwksUrl || (parentOrigin !== '*' ? `${parentOrigin.replace(/\/$/, '')}/.well-known/jwks.json` : null);
    this.issuer = issuer || (parentOrigin !== '*' ? parentOrigin : null);
    this.consumeUrl=consumeUrl||(parentOrigin!=='*'?`${parentOrigin.replace(/\/$/,'')}/v1/launches/consume`:null);
    this.eventsUrl=eventsUrl||(parentOrigin!=='*'?`${parentOrigin.replace(/\/$/,'')}/v1/launches/events`:null);
    this.allowUnsignedDev = allowUnsignedDev;
    this.fetchImpl = fetchImpl;
    this.transport = transport || null;
    this.listeners = new Map(EVENTS.map(name => [name, new Set()]));
    this.session = null;
    this.profile = null;
    this.channel = null;
    this.eventQueue=Promise.resolve();
    this.handleMessage = this.handleMessage.bind(this);
  }

  async init({ launchToken } = {}) {
    const localDev = localHostname(globalThis.location?.hostname || '');
    const legacyLocalToken = this.allowUnsignedDev && localDev ? new URLSearchParams(globalThis.location?.search || '').get('ggLaunch') : null;
    const token = launchToken || readLaunchToken() || legacyLocalToken;
    if (!token) throw new Error('Missing GG launch token');
    const signed = token.split('.').length === 3;
    let payload;
    if (signed) {
      payload=await verifySignedLaunchToken(token,{jwksUrl:this.jwksUrl,fetchImpl:this.fetchImpl,issuer:this.issuer,audience:globalThis.location?.origin});
      if(!this.consumeUrl)throw new Error('Signed launch consume endpoint is required');
      const consumed=await this.fetchImpl(this.consumeUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),credentials:'omit',referrerPolicy:'no-referrer'});
      if(!consumed.ok)throw new Error(consumed.status===409?'GG launch token was already consumed':'Unable to consume GG launch token');
      const channel=await consumed.json();this.eventChannelToken=channel.channelToken;this.eventSequence=0;
    }
    else {
      if (!this.allowUnsignedDev || !localDev) throw new Error('Unsigned GG launch tokens are allowed only on localhost with allowUnsignedDev');
      payload = decodeLaunchToken(token);
      if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) throw new Error('Launch token has expired');
    }
    if (payload.v !== (signed ? 2 : 1)) throw new Error('Unsupported GG protocol version');
    if (payload.game !== this.gameId) throw new Error('Launch token is for a different game');
    if (payload.gameOrigin && globalThis.location?.origin && payload.gameOrigin !== globalThis.location.origin) throw new Error('Launch token is not approved for this origin');
    this.parentOrigin = payload.platformOrigin || this.parentOrigin;
    if (this.parentOrigin === '*') throw new Error('Launch token is missing an exact platform origin');
    this.transport = this.transport || globalThis.opener;
    this.nonce = payload.nonce;
    this.profile = { id: payload.sub, name: payload.name, avatar: payload.avatar, ageBand: payload.age };
    if (typeof BroadcastChannel !== 'undefined' && payload.nonce) {
      this.channel = new BroadcastChannel(`gg-launch-${payload.nonce}`);
      this.channel.onmessage = event => this.handleMessage({ data: event.data, origin: this.parentOrigin });
    }
    globalThis.window?.addEventListener?.('message', this.handleMessage);
    this.send('ready', { gameId: this.gameId, protocol: signed ? 2 : 1 });
    if(signed)void this.sendTrustedEvent('ready',{gameId:this.gameId,protocol:2});
    const launch={ profile:this.profile,party:payload.party||[],sessionId:payload.sessionId,joinData:payload.joinData,permissions:payload.permissions||[] };
    this.emit('ready', launch);
    return launch;
  }

  setPresence(status, metadata = {}) {
    if (!['online', 'playing', 'offline'].includes(status)) throw new Error('Invalid presence status');
    const safe = { status, gameId: this.gameId, joinable: Boolean(metadata.joinable), sessionId: metadata.sessionId || null };
    this.send('presence', safe);void this.sendTrustedEvent('presence',safe);this.emit('presence', safe);
  }
  createSession({ id, maxPlayers = 8, joinData = null } = {}) { if(!id)throw new Error('Session id is required');if(maxPlayers<1||maxPlayers>8)throw new Error('Sessions support 1–8 players');this.session={id,maxPlayers,joinData,gameId:this.gameId};this.send('session',this.session);void this.sendTrustedEvent('session',this.session);this.emit('session',this.session);return this.session; }
  closeSession() { if(this.session){const payload={sessionId:this.session.id};this.send('leave',payload);void this.sendTrustedEvent('leave',payload);}this.session=null; }
  on(event,callback) { if(!this.listeners.has(event))throw new Error(`Unknown event: ${event}`);this.listeners.get(event).add(callback);return()=>this.listeners.get(event).delete(callback); }
  destroy() { this.closeSession();globalThis.window?.removeEventListener?.('message',this.handleMessage);this.channel?.close();this.listeners.forEach(set=>set.clear()); }
  send(type,payload) { const message={source:'gzowos-games-sdk',nonce:this.nonce,type,payload};this.transport?.postMessage?.(message,this.parentOrigin);this.channel?.postMessage(message); }
  sendTrustedEvent(type,payload){if(!this.eventChannelToken||!this.eventsUrl)return Promise.resolve();const sequence=++this.eventSequence,deliver=async()=>{try{const response=await this.fetchImpl(this.eventsUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({channelToken:this.eventChannelToken,sequence,type,payload}),credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)this.emit('error',new Error('Trusted launch event was rejected'));}catch(error){this.emit('error',error);}};this.eventQueue=this.eventQueue.catch(()=>{}).then(deliver);return this.eventQueue;}
  emit(type,payload) { this.listeners.get(type)?.forEach(callback=>callback(payload)); }
  handleMessage(event) { if(event.origin!==this.parentOrigin)return;const data=event.data;if(data?.source!=='gzowos-games-platform'||data.nonce!==this.nonce)return;this.emit(data.type,data.payload); }
}

export const createSDK = options => new GzowoGamesSDK(options);
