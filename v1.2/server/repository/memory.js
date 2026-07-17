import { createHash, randomBytes } from 'node:crypto';

export class MemoryRepository {
  constructor(seed = {}) {
    this.games=new Map((seed.games||[]).map(game=>[game.id,structuredClone(game)]));
    this.ageBands=new Map(Object.entries(seed.ageBands||{}));
    this.identities=new Map(Object.entries(seed.identities||{}));
    this.parentConsents=new Map();
    this.admins=new Map(Object.entries(seed.admins||{}));
    this.reports=new Map();
    this.messages=new Map((seed.messages||[]).map(message=>[message.id,structuredClone(message)]));
    this.threads=new Map((seed.threads||[]).map(thread=>[thread.id,structuredClone(thread)]));
    this.friendships=new Set((seed.friendships||[]).map(pair=>pair.slice().sort().join(':')));
    this.chatAllowed=new Map(Object.entries(seed.chatAllowed||{}));
    this.evidence=new Map();
    this.monitorRuns=[];
    this.parties=new Map(Object.entries(seed.parties||{}));
    this.consumedJtis=new Map();
    this.eventChannels=new Map();
    this.sdkChallenges=new Map();
    this.audit=[];
  }
  async getGame(id){return structuredClone(this.games.get(id)||null);}
  async saveTrustedGameCheck(id,check){const game=this.games.get(id);if(!game)throw new Error('Game not found');Object.assign(game,check);return structuredClone(game);}
  async setAgeBand(uid,band){this.ageBands.set(uid,band);return{uid,band};}
  async getAgeBand(uid){return this.ageBands.get(uid)||null;}
  async provisionIdentity(record){if(this.identities.has(record.uid))throw Object.assign(new Error('Identity is already provisioned'),{status:409});this.identities.set(record.uid,structuredClone(record));this.ageBands.set(record.uid,record.ageBand);if(record.parentConsent)this.parentConsents.set(record.uid,structuredClone(record.parentConsent));return{uid:record.uid,ageBand:record.ageBand,parentConsentStatus:record.parentConsent?.status||'not-required'};}
  async getAuthorizedPartyMembers(uid,requested){const allowed=new Set(this.parties.get(uid)||[]);return requested.filter(id=>allowed.has(id));}
  async setAdmin(uid,enabled){this.admins.set(uid,Boolean(enabled));return{uid,admin:Boolean(enabled)};}
  async writeAudit(entry){this.audit.push(structuredClone(entry));return entry;}
  async consumeLaunchJti({jti,exp,gameId,userId,origin,permissions,now}){for(const [id,expires]of this.consumedJtis)if(expires<=now)this.consumedJtis.delete(id);if(this.consumedJtis.has(jti))return null;this.consumedJtis.set(jti,exp*1000);const token=randomBytes(32).toString('base64url');this.eventChannels.set(createHash('sha256').update(token).digest('hex'),{gameId,userId,origin,permissions,lastSequence:0,expiresAt:exp*1000});return token;}
  async recordLaunchEvent({channelToken,sequence,type,payload,origin,now}){const key=createHash('sha256').update(channelToken).digest('hex'),channel=this.eventChannels.get(key);if(!channel||channel.expiresAt<=now||origin!==channel.origin||sequence!==channel.lastSequence+1)return null;if(['ready','presence'].includes(type)&&payload.gameId!==channel.gameId)return null;if(type==='session'&&payload.gameId&&payload.gameId!==channel.gameId)return null;if(type==='presence'&&!channel.permissions.includes('presence:write'))return null;if(type==='session'&&!channel.permissions.some(permission=>permission==='session:create'||permission==='session:join'))return null;channel.lastSequence=sequence;return{gameId:channel.gameId,userId:channel.userId,sequence,type,payload,at:now};}
  async canCreateSdkChallenge(gameId,ownerId){const game=this.games.get(gameId);return !game||game.ownerId===ownerId;}
  async isTrustedCorsOrigin(origin){if(Array.from(this.games.values()).some(game=>game.origin===origin&&game.status==='published'&&game.sdkPassed===true))return true;return Array.from(this.sdkChallenges.values()).some(item=>item.origin===origin&&item.status==='pending'&&item.expiresAt>Date.now());}
  async createSdkChallenge(challenge){this.sdkChallenges.set(challenge.id,structuredClone(challenge));return structuredClone(challenge);}
  async getSdkChallenge(id,ownerId){const item=this.sdkChallenges.get(id);return item&&item.ownerId===ownerId?structuredClone(item):null;}
  async completeSdkChallenge(id,origin,now){const item=this.sdkChallenges.get(id);if(!item||item.origin!==origin||item.expiresAt<=now||item.status!=='pending')return false;item.status='passed';item.passedAt=now;return true;}
  async claimSdkChallenge(id,ownerId,gameData,now){const item=this.sdkChallenges.get(id),current=this.games.get(gameData.id);if(!item||item.ownerId!==ownerId||item.status!=='passed'||item.gameId!==gameData.id||item.url!==gameData.url||(current&&current.ownerId!==ownerId))return null;let game;if(current?.status==='published'){game={...current,title:gameData.title,ageRating:gameData.ageRating,notes:gameData.notes,pendingUrl:item.url,pendingSdkHandshakeOrigin:item.origin,pendingSdkCheckedAt:item.passedAt||now};}else{game={...current,...structuredClone(gameData),ownerId,status:'submitted',sdkHandshakeOrigin:item.origin,sdkPassed:true,sdkCheckedAt:item.passedAt||now,origin:item.origin,visibility:current?.visibility||'visible'};}this.games.set(game.id,game);item.status='claimed';return structuredClone(game);}
  async canAccessReportTarget(reporterId,targetKind,targetId){if(targetKind!=='message')return true;const message=this.messages.get(targetId),thread=message&&this.threads.get(message.threadId);return Boolean(message&&thread?.members?.includes(reporterId));}
  async captureReport({id,reporterId,targetKind,targetId,reason,createdAt,retentionUntil}){let evidence=null;if(targetKind==='message'){const message=this.messages.get(targetId);if(message)evidence={kind:'message',id:message.id,threadId:message.threadId,authorId:message.authorId,text:message.text,createdAt:message.createdAt,retentionUntil,legalHold:true,sha256:createHash('sha256').update(JSON.stringify(message)).digest('hex')};}const report={id,reporterId,targetKind,targetId,reason,createdAt,retentionUntil,status:'open',evidenceId:evidence?`evidence-${id}`:null};this.reports.set(id,report);if(evidence)this.evidence.set(report.evidenceId,{...evidence,reportId:id,preservedAt:createdAt});return structuredClone({...report,evidence});}
  async createThread({id,ownerId,members,name,createdAt}){const unique=[...new Set(members)];if(!unique.includes(ownerId)||unique.length<2||unique.length>8)return null;for(const member of unique){if(this.chatAllowed.get(member)!==true)return null;if(member!==ownerId&&!this.friendships.has([ownerId,member].sort().join(':')))return null;}const thread={id,ownerId,members:unique,name,createdAt};this.threads.set(id,thread);return structuredClone(thread);}
  async sendMessage({id,threadId,authorId,text,kind,createdAt,expiresAt}){const thread=this.threads.get(threadId);if(!thread?.members.includes(authorId)||thread.members.some(member=>this.chatAllowed.get(member)!==true))return null;const message={id,threadId,authorId,text,kind,createdAt,expiresAt};this.messages.set(id,message);return structuredClone(message);}
  async approveParentConsent(childUid,parent){const consent=this.parentConsents.get(childUid);if(!consent||consent.status!=='pending'||parent.emailVerified!==true||consent.parentEmail!==parent.email?.toLowerCase())return null;consent.status='approved';consent.approvedAt=parent.now;const identity=this.identities.get(childUid);if(identity)identity.parentConsent={...consent};return structuredClone(consent);}
  async moderateReport({reportId,action,actorId,now}){const report=this.reports.get(reportId);if(!report||report.status!=='open')return null;report.status=action==='dismiss'?'dismissed':'resolved';report.action=action;report.resolvedAt=now;const evidence=report.evidenceId&&this.evidence.get(report.evidenceId);if(evidence)evidence.legalHold=true;await this.writeAudit({action:`report-${action}`,actorId,targetId:reportId,at:now});return structuredClone(report);}
  async cleanupExpired({now}){let evidenceDeleted=0;for(const[id,evidence]of this.evidence){const report=this.reports.get(evidence.reportId);if(report?.status!=='open'&&evidence.retentionUntil<=now){this.evidence.delete(id);evidenceDeleted+=1;}}let messagesDeleted=0;for(const[id,message]of this.messages){if(message.kind==='session'&&message.expiresAt<=now&&!Array.from(this.evidence.values()).some(item=>item.id===id&&item.legalHold)){this.messages.delete(id);messagesDeleted+=1;}}let gamesDeleted=0;for(const[id,game]of this.games){if(game.deleteAt&&game.deleteAt<=now){this.games.delete(id);gamesDeleted+=1;}}return{messagesDeleted,evidenceDeleted,gamesDeleted};}
  async recordMonitor(id,result){const entry={gameId:id,...result};this.monitorRuns.push(entry);return entry;}
}
