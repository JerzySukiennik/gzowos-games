import { timingSafeEqual, webcrypto } from 'node:crypto';
import { createJwks, signES256, verifyES256 } from './crypto/jws.js';
import { requireAdmin } from './auth.js';
import { monitorPublicUrl } from './security/url.js';
import { validatePublicHttpsUrl } from './security/url.js';

const AGE_BANDS = new Set(['U13', '13-17', '18+']);
const GAME_RATINGS = new Set(['E', '13+', '18+']);
const REPORT_KINDS = new Set(['account', 'game', 'message', 'group']);
const EVENT_TYPES=new Set(['ready','presence','session','leave','error']);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

async function readJson(request, limit = 16_384) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw Object.assign(new Error('Request body is too large'), { status: 413 });
  const text = await request.text();
  if (text.length > limit) throw Object.assign(new Error('Request body is too large'), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error('Request body must be valid JSON'), { status: 400 }); }
}

function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Object.assign(new Error(`${name} is invalid`), { status: 400 });
  return value.trim();
}

function safeObject(value, maxBytes = 4096) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > maxBytes) throw Object.assign(new Error('joinData is invalid'), { status: 400 });
  return structuredClone(value);
}

function ageAllowed(band, rating) {
  return rating === 'E' || (rating === '13+' && band !== 'U13') || (rating === '18+' && band === '18+');
}

export function deriveAgeBand(dateOfBirth, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth))) throw Object.assign(new Error('Date of birth must use YYYY-MM-DD'), { status: 400 });
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const [year,month,day]=String(dateOfBirth).split('-').map(Number);
  if (Number.isNaN(dob.getTime()) || dob.getUTCFullYear()!==year || dob.getUTCMonth()+1!==month || dob.getUTCDate()!==day || dob > now) throw Object.assign(new Error('Date of birth is invalid'), { status: 400 });
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) throw Object.assign(new Error('Date of birth is invalid'), { status: 400 });
  return age < 13 ? 'U13' : age < 18 ? '13-17' : '18+';
}

export function createApp({ authenticate, repository, signingKey, issuer, platformOrigin, clock = () => Date.now(), monitorTransport, testFetchImpl, lookup, adminBootstrap } = {}) {
  if (typeof authenticate !== 'function' || !repository || !signingKey?.privateKey || !signingKey?.publicKey || !signingKey?.kid) throw new Error('Trusted auth, repository and ES256 signing key are required');
  const normalizedIssuer = issuer || 'https://games.example';
  let jwksPromise;
  const jwks = () => jwksPromise ||= createJwks([signingKey]);
  const constantEquals=(left,right)=>{const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);};
  const eventPayload=(type,value)=>{const payload=safeObject(value,2048);if(!EVENT_TYPES.has(type)||!payload)throw Object.assign(new Error('Launch event type or payload is invalid'),{status:400});if(type==='ready'&&(payload.protocol!==2||typeof payload.gameId!=='string'))throw Object.assign(new Error('Ready event is invalid'),{status:400});if(type==='presence'&&(!['online','playing','offline'].includes(payload.status)||typeof payload.gameId!=='string'))throw Object.assign(new Error('Presence event is invalid'),{status:400});if(type==='session'&&(typeof payload.id!=='string'||payload.id.length>128||!Number.isInteger(payload.maxPlayers)||payload.maxPlayers<1||payload.maxPlayers>8))throw Object.assign(new Error('Session event is invalid'),{status:400});if(type==='leave'&&(typeof payload.sessionId!=='string'||payload.sessionId.length>128))throw Object.assign(new Error('Leave event is invalid'),{status:400});if(type==='error'&&(typeof payload.code!=='string'||payload.code.length>80||typeof payload.message!=='string'||payload.message.length>500))throw Object.assign(new Error('Error event is invalid'),{status:400});return payload;};
  const corsAllowed=async(origin,path)=>{if(!origin)return false;if(origin===(platformOrigin||new URL(normalizedIssuer).origin))return true;if(path.startsWith('/v1/launches/'))return repository.isTrustedCorsOrigin(origin);return false;};

  async function principal(request) {
    try { return await authenticate(request); } catch (error) { if (!error.status) error.status = 401; throw error; }
  }

  async function route(request) {
    const url = new URL(request.url);
    if(request.method==='OPTIONS'){const origin=request.headers.get('origin'),requestedMethod=(request.headers.get('access-control-request-method')||'').toUpperCase(),requestedHeaders=(request.headers.get('access-control-request-headers')||'').toLowerCase().split(',').map(item=>item.trim()).filter(Boolean),allowedMethods=['GET','POST','PUT','OPTIONS'],allowedHeaders=['authorization','content-type','x-gg-bootstrap-secret'];if(!await corsAllowed(origin,url.pathname)||!allowedMethods.includes(requestedMethod)||requestedHeaders.some(header=>!allowedHeaders.includes(header)))return new Response(null,{status:403});return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':allowedMethods.join(', '),'access-control-allow-headers':allowedHeaders.join(', '),'access-control-max-age':'600','vary':'origin'}});}
    if (request.method === 'GET' && url.pathname === '/.well-known/jwks.json') return json(await jwks(), 200, { 'cache-control': 'public, max-age=300' });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'gzowos-games-trusted-api' });

    if (request.method === 'POST' && url.pathname === '/v1/launch-tokens') {
      const user = await principal(request);
      const body = await readJson(request);
      const gameId = text(body.gameId, 'gameId', 100);
      const game = await repository.getGame(gameId);
      if (!game || game.status !== 'published' || game.visibility === 'hidden' || game.sdkPassed !== true || !game.origin) throw Object.assign(new Error('Game is not approved for launch'), { status: 403 });
      const ageBand = await repository.getAgeBand(user.uid);
      if (!AGE_BANDS.has(ageBand)) throw Object.assign(new Error('Verified age band is required'), { status: 403 });
      if (!GAME_RATINGS.has(game.ageRating) || !ageAllowed(ageBand, game.ageRating)) throw Object.assign(new Error('Game is unavailable for this age band'), { status: 403 });
      const now = Math.floor(clock() / 1000);
      const permissions = [...new Set((Array.isArray(body.permissions) ? body.permissions : []).filter(permission => (game.permissions || []).includes(permission)))].slice(0, 8);
      const requestedParty = Array.isArray(body.party) ? [...new Set(body.party.filter(id => typeof id === 'string'))].slice(0, 8) : [];
      const party = typeof repository.getAuthorizedPartyMembers === 'function' ? await repository.getAuthorizedPartyMembers(user.uid, requestedParty) : [];
      const requestedSession = { sessionId:body.sessionId,joinData:safeObject(body.joinData) };
      const session = typeof repository.authorizeLaunchSession === 'function' ? await repository.authorizeLaunchSession(user.uid, game.id, requestedSession) : { sessionId:webcrypto.randomUUID(),joinData:{mode:'create'} };
      const payload = {
        iss: normalizedIssuer,
        aud: game.origin,
        v: 2,
        sub: user.uid,
        name: user.name,
        avatar: user.avatar,
        game: game.id,
        gameOrigin: game.origin,
        platformOrigin: platformOrigin || new URL(normalizedIssuer).origin,
        age: ageBand,
        party,
        sessionId: typeof session?.sessionId === 'string' && session.sessionId.length <= 128 ? session.sessionId : webcrypto.randomUUID(),
        joinData: safeObject(session?.joinData),
        permissions,
        nonce: webcrypto.randomUUID(),
        jti: webcrypto.randomUUID(),
        iat: now,
        exp: now + 180
      };
      return json({ token: await signES256(payload, signingKey), expiresAt: payload.exp * 1000, gameOrigin: game.origin });
    }

    if(request.method==='POST'&&url.pathname==='/v1/launches/consume'){
      const body=await readJson(request),keys=await jwks(),now=Math.floor(clock()/1000),verified=await verifyES256(text(body.token,'token',8192),{jwks:keys,now,issuer:normalizedIssuer});
      const payload=verified.payload,origin=request.headers.get('origin');
      if(origin!==payload.gameOrigin||payload.aud!==origin)throw Object.assign(new Error('Launch consume origin mismatch'),{status:403});
      const channelToken=await repository.consumeLaunchJti({jti:payload.jti,exp:payload.exp,gameId:payload.game,userId:payload.sub,origin,permissions:payload.permissions||[],now:clock()});
      if(!channelToken)throw Object.assign(new Error('Launch token was already consumed'),{status:409});
      if(payload.joinData?.mode==='sdk-check'){const passed=await repository.completeSdkChallenge(payload.joinData.challengeId,origin,clock());if(!passed)throw Object.assign(new Error('SDK challenge is invalid'),{status:403});}
      return json({channelToken,expiresAt:payload.exp*1000,protocol:2},201,{'access-control-allow-origin':origin});
    }

    if(request.method==='POST'&&url.pathname==='/v1/launches/events'){
      const body=await readJson(request),type=text(body.type,'type',40),payload=eventPayload(type,body.payload),event=await repository.recordLaunchEvent({channelToken:text(body.channelToken,'channelToken',256),sequence:body.sequence,type,payload,origin:request.headers.get('origin'),now:clock()});
      if(!event)throw Object.assign(new Error('Event channel or sequence is invalid'),{status:409});
      return json({accepted:true,sequence:event.sequence},202,{'access-control-allow-origin':request.headers.get('origin')});
    }

    if(request.method==='POST'&&url.pathname==='/v1/sdk-checks'){
      const user=await principal(request),body=await readJson(request),gameId=text(body.gameId,'gameId',100);if(!await repository.canCreateSdkChallenge(gameId,user.uid))throw Object.assign(new Error('Game ID belongs to another owner'),{status:403});const checked=await validatePublicHttpsUrl(text(body.url,'url',2048),{lookup}),now=Math.floor(clock()/1000),id=webcrypto.randomUUID(),jti=webcrypto.randomUUID(),nonce=webcrypto.randomUUID(),origin=checked.url.origin;
      await repository.createSdkChallenge({id,ownerId:user.uid,gameId,url:checked.url.href,origin,status:'pending',createdAt:clock(),expiresAt:clock()+120000});
      const token=await signES256({iss:normalizedIssuer,aud:origin,v:2,sub:'gg-sdk-validator',name:'GG SDK validator',avatar:null,game:gameId,gameOrigin:origin,platformOrigin:platformOrigin||new URL(normalizedIssuer).origin,age:'18+',party:[],sessionId:`sdk-check-${id}`,joinData:{mode:'sdk-check',challengeId:id},permissions:['profile:basic'],nonce,jti,iat:now,exp:now+120},signingKey);
      return json({id,token,nonce,launchUrl:`${checked.url.href.split('#')[0]}#${new URLSearchParams({ggLaunch:token})}`,origin,expiresAt:(now+120)*1000},201);
    }

    if(request.method==='GET'&&url.pathname.startsWith('/v1/sdk-checks/')){const user=await principal(request),id=decodeURIComponent(url.pathname.slice('/v1/sdk-checks/'.length)),challenge=await repository.getSdkChallenge(id,user.uid);if(!challenge)throw Object.assign(new Error('SDK challenge not found'),{status:404});return json({id,status:challenge.status,origin:challenge.origin,passedAt:challenge.passedAt||null});}

    if(request.method==='POST'&&url.pathname.match(/^\/v1\/sdk-checks\/[^/]+\/claim$/)){const user=await principal(request),id=decodeURIComponent(url.pathname.split('/')[3]),body=await readJson(request),claimed=await repository.claimSdkChallenge(id,user.uid,{id:text(body.gameId,'gameId',100),title:text(body.title,'title',80),url:text(body.url,'url',2048),ageRating:body.ageRating,notes:typeof body.notes==='string'?body.notes.slice(0,4000):''},clock());if(!claimed)throw Object.assign(new Error('SDK challenge cannot be claimed'),{status:409});return json({gameId:claimed.id,sdkPassed:claimed.pendingUrl?false:claimed.sdkPassed===true,status:claimed.status,pendingUrl:claimed.pendingUrl||null});}

    if (request.method === 'POST' && url.pathname === '/v1/onboarding/age-band') {
      const user = await principal(request);
      const body = await readJson(request);
      const band = deriveAgeBand(body.dateOfBirth, new Date(clock())),parentEmail=typeof body.parentEmail==='string'?body.parentEmail.trim().toLowerCase():'';
      if(band==='U13'&&!/^\S+@\S+\.\S+$/.test(parentEmail))throw Object.assign(new Error('Verified parent email is required for U13 onboarding'),{status:400});
      const result=await repository.provisionIdentity({uid:user.uid,dateOfBirth:body.dateOfBirth,ageBand:band,parentEmail:band==='U13'?parentEmail:'',parentConsent:band==='U13'?{childUid:user.uid,parentEmail,status:'pending',createdAt:clock()}:null,createdAt:clock()});
      return json(result,201);
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/v1/admin/age-bands/')) {
      const user = await principal(request);requireAdmin(user);
      const uid = decodeURIComponent(url.pathname.slice('/v1/admin/age-bands/'.length));
      const body = await readJson(request);
      if (!uid || !AGE_BANDS.has(body.ageBand)) throw Object.assign(new Error('uid or ageBand is invalid'), { status: 400 });
      return json(await repository.setAgeBand(uid, body.ageBand));
    }

    if (request.method === 'PUT' && url.pathname.startsWith('/v1/admin/admins/')) {
      const user = await principal(request);requireAdmin(user);
      const uid = decodeURIComponent(url.pathname.slice('/v1/admin/admins/'.length));
      const body = await readJson(request);
      if (!uid || typeof body.enabled !== 'boolean') throw Object.assign(new Error('uid or enabled is invalid'), { status: 400 });
      if(typeof adminBootstrap?.setAdminClaim!=='function')throw Object.assign(new Error('Admin claims adapter is unavailable'),{status:503});
      await adminBootstrap.setAdminClaim(uid,body.enabled);const result=await repository.setAdmin(uid,body.enabled);await repository.writeAudit({action:'admin-claim-set',actorId:user.uid,targetId:uid,enabled:body.enabled,at:clock()});return json(result);
    }

    if(request.method==='POST'&&url.pathname==='/v1/admin/bootstrap'){const user=await principal(request),secret=request.headers.get('x-gg-bootstrap-secret');if(!adminBootstrap?.allowedUids?.includes(user.uid)||!constantEquals(secret,adminBootstrap.secret)||typeof adminBootstrap.setAdminClaim!=='function')throw Object.assign(new Error('Bootstrap authorization failed'),{status:403});await adminBootstrap.setAdminClaim(user.uid,true);await repository.setAdmin(user.uid,true);await repository.writeAudit({action:'admin-bootstrap',actorId:user.uid,targetId:user.uid,at:clock()});return json({uid:user.uid,admin:true});}

    if(request.method==='POST'&&url.pathname.match(/^\/v1\/parent-consents\/[^/]+\/approve$/)){const user=await principal(request),childUid=decodeURIComponent(url.pathname.split('/')[3]),consent=await repository.approveParentConsent(childUid,{email:user.email,emailVerified:user.emailVerified,uid:user.uid,now:clock()});if(!consent)throw Object.assign(new Error('Verified parent consent approval denied'),{status:403});await repository.writeAudit({action:'parent-consent-approved',actorId:user.uid,targetId:childUid,at:clock()});return json({childUid,status:'approved'});}

    if (request.method === 'POST' && url.pathname === '/v1/reports') {
      const user = await principal(request);
      const body = await readJson(request);
      if (!REPORT_KINDS.has(body.targetKind)) throw Object.assign(new Error('targetKind is invalid'), { status: 400 });
      const targetId=text(body.targetId,'targetId',160);if(!await repository.canAccessReportTarget(user.uid,body.targetKind,targetId))throw Object.assign(new Error('Reporter cannot access this target'),{status:403});
      const createdAt=clock(),report = await repository.captureReport({id:webcrypto.randomUUID(),reporterId:user.uid,targetKind:body.targetKind,targetId,reason:text(body.reason,'reason',500),createdAt,retentionUntil:createdAt+365*86400000});
      return json({ id: report.id, status: report.status, evidencePreserved: Boolean(report.evidenceId) }, 201);
    }

    if(request.method==='POST'&&url.pathname==='/v1/threads'){const user=await principal(request),body=await readJson(request),thread=await repository.createThread({id:webcrypto.randomUUID(),ownerId:user.uid,members:Array.isArray(body.members)?body.members:[],name:typeof body.name==='string'?body.name.slice(0,80):'Group',createdAt:clock()});if(!thread)throw Object.assign(new Error('All thread members must be accepted friends with chat enabled'),{status:403});return json(thread,201);}
    if(request.method==='POST'&&url.pathname.match(/^\/v1\/threads\/[^/]+\/messages$/)){const user=await principal(request),threadId=decodeURIComponent(url.pathname.split('/')[3]),body=await readJson(request),kind=['private','group','session'].includes(body.kind)?body.kind:'private',message=await repository.sendMessage({id:webcrypto.randomUUID(),threadId,authorId:user.uid,text:text(body.text,'text',1000),kind,createdAt:clock(),expiresAt:kind==='session'?clock()+86400000:null});if(!message)throw Object.assign(new Error('Thread access or recipient chat policy denied'),{status:403});return json(message,201);}

    if(request.method==='POST'&&url.pathname.match(/^\/v1\/admin\/reports\/[^/]+\/moderate$/)){const user=await principal(request);requireAdmin(user);const reportId=decodeURIComponent(url.pathname.split('/')[4]),body=await readJson(request),action=body.action;if(!['warning','mute','suspend','ban','dismiss'].includes(action))throw Object.assign(new Error('Moderation action is invalid'),{status:400});const report=await repository.moderateReport({reportId,action,actorId:user.uid,now:clock()});if(!report)throw Object.assign(new Error('Open report not found'),{status:404});return json({reportId,status:report.status,action});}

    if (request.method === 'POST' && url.pathname === '/v1/admin/cleanup') {
      const user = await principal(request);requireAdmin(user);
      return json(await repository.cleanupExpired({ now: clock() }));
    }

    if (request.method === 'POST' && url.pathname.startsWith('/v1/admin/games/') && url.pathname.endsWith('/monitor')) {
      const user = await principal(request);requireAdmin(user);
      const gameId = decodeURIComponent(url.pathname.slice('/v1/admin/games/'.length, -'/monitor'.length));
      const game = await repository.getGame(gameId);
      if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
      const candidateUrl=game.pendingUrl||game.url;
      const result = await monitorPublicUrl(candidateUrl, { transport:monitorTransport,testFetchImpl,lookup,allowTestTransport:Boolean(testFetchImpl) });
      const checkedOrigin=new URL(result.url).origin,pending=Boolean(game.pendingUrl),handshakeOrigin=pending?game.pendingSdkHandshakeOrigin:game.sdkHandshakeOrigin,sdkPassed=Boolean(result.ok&&handshakeOrigin===checkedOrigin);
      const trusted=pending?(sdkPassed?{url:result.url,pendingUrl:null,sdkPassed:true,sdkCheckedAt:clock(),origin:checkedOrigin,monitorStatus:result.status,sdkHandshakeOrigin:checkedOrigin,pendingSdkHandshakeOrigin:null,pendingSdkCheckedAt:null}:{pendingMonitorStatus:result.status,pendingSdkCheckedAt:clock()}):{sdkPassed,sdkCheckedAt:clock(),origin:checkedOrigin,monitorStatus:result.status};
      await repository.saveTrustedGameCheck(gameId, trusted);
      await repository.recordMonitor(gameId, result);
      return json({ gameId, ...result, ...trusted });
    }
    return json({ error: 'Not found' }, 404);
  }

  return {
    async fetch(request) {
      let response;
      try {
        response = await route(request);
      } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        response = json({ error: status === 500 ? 'Internal server error' : error.message }, status);
      }
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('referrer-policy', 'no-referrer');
      const requestUrl=new URL(request.url),origin=request.headers.get('origin');
      if(requestUrl.pathname==='/.well-known/jwks.json')response.headers.set('access-control-allow-origin','*');
      else if(origin&&await corsAllowed(origin,requestUrl.pathname)){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','origin');}
      return response;
    }
  };
}
