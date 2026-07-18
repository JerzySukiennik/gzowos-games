export function sendFriendRequest(state,personId){if(state.friends.includes(personId)||state.requests.includes(personId)||state.outgoingRequests.includes(personId))return false;state.outgoingRequests.push(personId);return true;}
export function acceptIncomingFriend(state,personId){if(state.outgoingRequests.includes(personId)||!state.requests.includes(personId)||state.friends.length>=50)return false;state.requests=state.requests.filter(id=>id!==personId);state.friends.push(personId);return true;}
export function removeFriend(state,personId){state.friends=state.friends.filter(id=>id!==personId);return state;}
export function createReport(state,{id,target,targetKind,context,date}){const report={id,target,targetKind,reason:'User report',context,status:'open',created:date};state.moderation.push(report);return report;}
export function applyModeration(state,id,action){const item=state.moderation.find(report=>report.id===id);if(!item)return null;item.status='closed';item.action=action;if(action==='ban'&&!state.blocked.includes(item.target))state.blocked.push(item.target);return item;}
export function upsertSubmission(state,id,payload){const existing=state.submissions.find(item=>item.id===id);if(existing)Object.assign(existing,payload);else state.submissions.push({id,...payload});return state.submissions.find(item=>item.id===id);}
export function transitionSubmission(state,id,status,at=Date.now()){
  const submission=state.submissions.find(item=>item.id===id);
  const allowed={submitted:['requiredChanges','rejected','approved'],approved:['published']}[submission?.status]||[];
  if(!submission||!allowed.includes(status))return null;
  submission.status=status;
  submission.updated=new Date(at).toISOString().slice(0,10);
  if(status==='published')submission.publishedAt=submission.publishedAt||submission.updated;
  return submission;
}
export function setSubmissionVisibility(state,id,visible){const submission=state.submissions.find(item=>item.id===id);if(!submission||submission.status!=='published')return null;submission.visibility=visible?'visible':'hidden';return submission;}
export function scheduleSubmissionDeletion(state,id,now=Date.now()){const submission=setSubmissionVisibility(state,id,false);if(!submission)return null;submission.deleteAt=now+30*86400000;return submission;}
export function cancelSubmissionDeletion(state,id){const submission=state.submissions.find(item=>item.id===id);if(!submission)return null;delete submission.deleteAt;submission.visibility='visible';return submission;}
export function upsertUserReview(state,{gameId,userId,user,stars,text,date}){const existing=state.reviews.find(review=>review.gameId===gameId&&review.userId===userId),previousStars=existing?.stars;if(existing)Object.assign(existing,{user,stars,text,date});else state.reviews.push({id:crypto.randomUUID(),gameId,userId,user,stars,text,date});return {review:existing||state.reviews.at(-1),previousStars};}
export function blockUser(state,personId){if(!state.blocked.includes(personId))state.blocked.push(personId);state.friends=state.friends.filter(id=>id!==personId);state.requests=state.requests.filter(id=>id!==personId);state.outgoingRequests=state.outgoingRequests.filter(id=>id!==personId);state.party=state.party.filter(id=>id!==personId);return state;}
export function preserveReportEvidence(state,messageId){if(!state.reportEvidence.includes(messageId))state.reportEvidence.push(messageId);return state.reportEvidence;}
export function expireSessionMessages(state,now=Date.now()){state.messages=state.messages.filter(message=>message.kind!=='session'||now-message.at<86400000||state.reportEvidence.includes(message.id));return state.messages;}
