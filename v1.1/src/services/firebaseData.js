import { firebaseReady } from './firebase.js';

let services;
async function getServices() {
  if (!firebaseReady) return null;
  if (services) return services;
  const [{ getApp }, firestore, database] = await Promise.all([import('firebase/app'), import('firebase/firestore'), import('firebase/database')]);
  const app=getApp();
  services={ firestore, database, db:firestore.getFirestore(app), rtdb:database.getDatabase(app) };
  return services;
}

export const firebaseData = {
  async saveProfile(user) {
    const s=await getServices(); if(!s)return;
    const { setDoc, doc, serverTimestamp }=s.firestore;
    await setDoc(doc(s.db,'users',user.id),{username:user.username,displayName:user.displayName,bio:user.bio||'',avatar:user.avatar||'',role:'user',updatedAt:serverTimestamp()},{merge:true});
  },
  async uploadAvatar(uid,file) { if(!firebaseReady)return null; const [{getApp},storage]=await Promise.all([import('firebase/app'),import('firebase/storage')]);const bucket=storage.getStorage(getApp()),extension=(file.type.split('/')[1]||'webp').replace('jpeg','jpg'),target=storage.ref(bucket,`avatars/${uid}/avatar.${extension}`);await storage.uploadBytes(target,file,{contentType:file.type});return storage.getDownloadURL(target); },
  async scheduleAccountDeletion(uid,requestedAt) { const s=await getServices();if(!s)return;return s.firestore.setDoc(s.firestore.doc(s.db,'users',uid),{deletionRequestedAt:requestedAt||null},{merge:true}); },
  async add(collectionName,payload) { const s=await getServices(); if(!s)return null; return s.firestore.addDoc(s.firestore.collection(s.db,collectionName),{...payload,createdAt:s.firestore.serverTimestamp()}); },
  async createReport(id,payload) { const s=await getServices(); if(!s)return null; await s.firestore.setDoc(s.firestore.doc(s.db,'reports',id),{...payload,createdAt:s.firestore.serverTimestamp()}); return id; },
  async claimUsername(uid,username) { const s=await getServices(); if(!s)return; const { runTransaction,doc,serverTimestamp }=s.firestore; return runTransaction(s.db,async transaction=>{const ref=doc(s.db,'usernames',username),snapshot=await transaction.get(ref);if(snapshot.exists()&&snapshot.data().uid!==uid)throw new Error('Username is already taken');transaction.set(ref,{uid,createdAt:serverTimestamp()});}); },
  async savePreferences(uid,preferences) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'users',uid,'preferences','main'),preferences,{merge:true}); },
  async savePublicPrivacy(uid,privacy) { const s=await getServices();if(!s)return;return s.firestore.setDoc(s.firestore.doc(s.db,'users',uid),privacy,{merge:true}); },
  async saveReview(gameId,uid,payload) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'reviews',`${gameId}_${uid}`),{...payload,gameId,userId:uid,updatedAt:s.firestore.serverTimestamp()},{merge:true}); },
  async requestFriend(senderId,targetId) { const s=await getServices(); if(!s)return; const id=[senderId,targetId].sort().join('_'); return s.firestore.setDoc(s.firestore.doc(s.db,'friendships',id),{members:[senderId,targetId],senderId,status:'pending',createdAt:s.firestore.serverTimestamp()}); },
  async respondFriend(id,status) { const s=await getServices(); if(!s)return; return s.firestore.updateDoc(s.firestore.doc(s.db,'friendships',id),{status,respondedAt:s.firestore.serverTimestamp()}); },
  async deleteFriend(id) { const s=await getServices(); if(!s)return; return s.firestore.deleteDoc(s.firestore.doc(s.db,'friendships',id)); },
  async createThread(ownerId,members,name='Group') { const s=await getServices(); if(!s)return; return s.firestore.addDoc(s.firestore.collection(s.db,'threads'),{ownerId,members:[...new Set(members)].slice(0,8),name,createdAt:s.firestore.serverTimestamp()}); },
  async sendMessage(threadId,authorId,text,kind='private') { const s=await getServices(); if(!s)return; return s.firestore.addDoc(s.firestore.collection(s.db,'threads',threadId,'messages'),{authorId,text:text.slice(0,1000),kind,createdAt:s.firestore.serverTimestamp(),expiresAt:kind==='session'?Date.now()+86400000:null}); },
  async saveGame(gameId,payload) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'games',gameId),payload,{merge:true}); },
  async moderateReport(reportId,status,action) { const s=await getServices(); if(!s)return; await s.firestore.updateDoc(s.firestore.doc(s.db,'reports',reportId),{status,action,updatedAt:s.firestore.serverTimestamp()}); return this.add('audit',{action,reportId}); },
  async applyModeration(targetId,kind,action) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'moderationTargets',targetId),{targetId,kind,action,active:action!=='dismiss',updatedAt:s.firestore.serverTimestamp()},{merge:true}); },
  async notify(uid,payload) { const s=await getServices(); if(!s)return; return s.firestore.addDoc(s.firestore.collection(s.db,'users',uid,'notifications'),{...payload,recipientId:uid,createdAt:s.firestore.serverTimestamp()}); },
  async requestParentConsent(childUid,parentEmail) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'parentConsents',childUid),{childUid,parentEmail,status:'pending',createdAt:s.firestore.serverTimestamp()}); },
  async approveParentConsent(childUid) { const s=await getServices(); if(!s)return; return s.firestore.updateDoc(s.firestore.doc(s.db,'parentConsents',childUid),{status:'approved',approvedAt:s.firestore.serverTimestamp()}); },
  async watchParentConsent(childUid,callback) { const s=await getServices(); if(!s)return()=>{}; return s.firestore.onSnapshot(s.firestore.doc(s.db,'parentConsents',childUid),snapshot=>callback(snapshot.exists()&&snapshot.data().status==='approved')); },
  async watchParentRequests(parentEmail,callback) { const s=await getServices(); if(!s)return()=>{}; const q=s.firestore.query(s.firestore.collection(s.db,'parentConsents'),s.firestore.where('parentEmail','==',parentEmail));return s.firestore.onSnapshot(q,snapshot=>callback(snapshot.docs.map(doc=>({id:doc.id,...doc.data()})))); },
  async saveParentView(childUid,view) { const s=await getServices(); if(!s)return; return s.firestore.setDoc(s.firestore.doc(s.db,'parentViews',childUid),{...view,updatedAt:s.firestore.serverTimestamp()},{merge:true}); },
  async watchParentView(childUid,callback) { const s=await getServices(); if(!s)return()=>{}; return s.firestore.onSnapshot(s.firestore.doc(s.db,'parentViews',childUid),snapshot=>callback(snapshot.exists()?snapshot.data():null)); },
  async setParentControls(childUid,controls) { const s=await getServices();if(!s)return;return s.firestore.setDoc(s.firestore.doc(s.db,'parentControls',childUid),controls,{merge:true}); },
  async watchParentControls(childUid,callback) { const s=await getServices();if(!s)return()=>{};return s.firestore.onSnapshot(s.firestore.doc(s.db,'parentControls',childUid),snapshot=>callback(snapshot.exists()?snapshot.data():{chatEnabled:false,approvedFriendIds:[]})); },
  async setPresence(uid,payload) { const s=await getServices(); if(!s)return; const ref=s.database.ref(s.rtdb,`presence/${uid}`),record={...payload,visibility:payload.visibility||'friends',joinPrivacy:payload.joinPrivacy||'friends',lastChanged:s.database.serverTimestamp()}; await s.database.set(ref,record); s.database.onDisconnect(ref).set({state:'offline',gameId:null,sessionId:null,joinable:false,visibility:record.visibility,joinPrivacy:record.joinPrivacy,lastChanged:s.database.serverTimestamp()}); },
  async createSession(uid,session) { const s=await getServices(); if(!s)return; return s.database.set(s.database.ref(s.rtdb,`sessions/${session.id}`),{...session,hostId:uid,maxPlayers:Math.min(8,session.maxPlayers)}); }
  ,async joinWaitlist(uid,sessionId) { const s=await getServices(); if(!s)return; return s.database.set(s.database.ref(s.rtdb,`waitlists/${sessionId}/${uid}`),{createdAt:s.database.serverTimestamp(),notify:true}); }
  ,async syncFriendAccess(uid,friendId,allowed) { const s=await getServices(); if(!s)return; return s.database.set(s.database.ref(s.rtdb,`friendAccess/${uid}/${friendId}`),Boolean(allowed)); }
  ,async subscribeAccount(uid,{admin=false,onData=()=>{}}={}) {
    const s=await getServices(); if(!s)return()=>{};
    const {collection,doc,onSnapshot,query,where,orderBy}=s.firestore;
    const unsubs=[],gameSets={published:[],owned:[]},messageUnsubs=new Map(),messageSets=new Map(),presenceUnsubs=new Map(),presence={};let profileIds=[],acceptedIds=[],grantedIds=[];
    const emitGames=()=>onData({games:[...new Map([...gameSets.published,...gameSets.owned].map(game=>[game.id,game])).values()]});
    const mapDocs=snapshot=>snapshot.docs.map(item=>({id:item.id,...item.data()}));
    const restartPresence=()=>{
      for(const [profileId,unsubscribe] of presenceUnsubs){if(!profileIds.includes(profileId)){unsubscribe();presenceUnsubs.delete(profileId);delete presence[profileId];}}
      profileIds.forEach(profileId=>{if(presenceUnsubs.has(profileId))return;if(acceptedIds.includes(profileId))void s.database.set(s.database.ref(s.rtdb,`friendAccess/${uid}/${profileId}`),true);const unsubscribe=s.database.onValue(s.database.ref(s.rtdb,`presence/${profileId}`),snapshot=>{presence[profileId]=snapshot.val()||{state:'offline'};onData({presence:{...presence}});},()=>{presence[profileId]={state:'offline'};onData({presence:{...presence}});});presenceUnsubs.set(profileId,unsubscribe);});
    };
    unsubs.push(onSnapshot(collection(s.db,'users'),snapshot=>{const profiles=mapDocs(snapshot);profileIds=profiles.map(profile=>profile.id).filter(id=>id!==uid);restartPresence();onData({profiles});}));
    unsubs.push(onSnapshot(query(collection(s.db,'games'),where('status','==','published'),where('visibility','==','visible')),snapshot=>{gameSets.published=mapDocs(snapshot);emitGames();}));
    unsubs.push(onSnapshot(query(collection(s.db,'games'),where('ownerId','==',uid)),snapshot=>{gameSets.owned=mapDocs(snapshot);emitGames();}));
    unsubs.push(onSnapshot(collection(s.db,'reviews'),snapshot=>onData({reviews:mapDocs(snapshot).map(review=>({...review,date:review.updatedAt?.toDate?.().toISOString().slice(0,10)||review.createdAt?.toDate?.().toISOString().slice(0,10)||new Date().toISOString().slice(0,10)}))})));
    unsubs.push(onSnapshot(doc(s.db,'users',uid,'preferences','main'),snapshot=>{if(snapshot.exists())onData({preferences:snapshot.data()});}));
    unsubs.push(onSnapshot(query(collection(s.db,'users',uid,'notifications'),orderBy('createdAt','desc')),snapshot=>onData({notifications:mapDocs(snapshot).map(item=>({...item,at:item.createdAt?.toMillis?.()||Date.now()}))})));
    unsubs.push(onSnapshot(query(collection(s.db,'friendships'),where('members','array-contains',uid)),snapshot=>{const friendships=mapDocs(snapshot),nextAccepted=friendships.filter(item=>item.status==='accepted').map(item=>item.members.find(member=>member!==uid)).filter(Boolean);for(const removedId of grantedIds.filter(id=>!nextAccepted.includes(id)))void s.database.set(s.database.ref(s.rtdb,`friendAccess/${uid}/${removedId}`),false);acceptedIds=nextAccepted;grantedIds=[...nextAccepted];restartPresence();onData({friendships});}));
    unsubs.push(onSnapshot(query(collection(s.db,'threads'),where('members','array-contains',uid)),snapshot=>{
      const threads=mapDocs(snapshot),ids=new Set(threads.map(thread=>thread.id));
      for(const [id,unsubscribe] of messageUnsubs){if(!ids.has(id)){unsubscribe();messageUnsubs.delete(id);messageSets.delete(id);}}
      threads.forEach(thread=>{if(messageUnsubs.has(thread.id))return;const messagesQuery=query(collection(s.db,'threads',thread.id,'messages'),orderBy('createdAt','asc'));messageUnsubs.set(thread.id,onSnapshot(messagesQuery,messageSnapshot=>{messageSets.set(thread.id,mapDocs(messageSnapshot).map(message=>({...message,threadId:thread.id,at:message.createdAt?.toMillis?.()||Date.now(),from:message.authorId})));onData({threads,messages:[...messageSets.values()].flat()});}));});
      onData({threads,messages:[...messageSets.values()].flat()});
    }));
    if(admin)unsubs.push(onSnapshot(query(collection(s.db,'reports'),orderBy('createdAt','desc')),snapshot=>onData({reports:mapDocs(snapshot).map(report=>({...report,created:report.createdAt?.toDate?.().toISOString().slice(0,10)||''}))})));
    return()=>{unsubs.forEach(unsubscribe=>unsubscribe());messageUnsubs.forEach(unsubscribe=>unsubscribe());presenceUnsubs.forEach(unsubscribe=>unsubscribe());};
  }
};
