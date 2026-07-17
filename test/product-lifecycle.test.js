import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogGames } from '../src/store.js';
import { blockUser, cancelSubmissionDeletion, expireSessionMessages, preserveReportEvidence, scheduleSubmissionDeletion, setSubmissionVisibility, transitionSubmission, upsertUserReview } from '../src/stateActions.js';

const published = () => ({
  gameStats: {},
  submissions: [{ id:'community', title:'Community Game', url:'https://game.example/', ageRating:'13+', status:'published', visibility:'visible', owner:'creator', sdkPassed:true, notes:'A real community game.', created:'2026-07-16' }]
});

test('published creator games enter catalog and hide/delete lifecycle removes them immediately',()=>{
  const state=published();
  assert.equal(catalogGames(state).some(game=>game.id==='community'),true);
  setSubmissionVisibility(state,'community',false);
  assert.equal(catalogGames(state).some(game=>game.id==='community'),false);
  setSubmissionVisibility(state,'community',true);
  const scheduled=scheduleSubmissionDeletion(state,'community',1000);
  assert.equal(scheduled.deleteAt,1000+30*86400000);
  assert.equal(catalogGames(state).some(game=>game.id==='community'),false);
  cancelSubmissionDeletion(state,'community');
  assert.equal(catalogGames(state).some(game=>game.id==='community'),true);
});

test('publication lifecycle only allows the contracted transitions',()=>{
  const state={submissions:[{id:'g',title:'Game',status:'submitted'}]};
  assert.equal(transitionSubmission(state,'g','published'),null);
  assert.equal(transitionSubmission(state,'g','approved')?.status,'approved');
  assert.equal(transitionSubmission(state,'g','published')?.status,'published');
});

test('one user review is updated rather than duplicated',()=>{
  const state={reviews:[]};
  assert.equal(upsertUserReview(state,{gameId:'g',userId:'u',user:'User',stars:2,text:'Okay',date:'2026-01-01'}).previousStars,undefined);
  assert.equal(upsertUserReview(state,{gameId:'g',userId:'u',user:'User',stars:5,text:'Great',date:'2026-01-02'}).previousStars,2);
  assert.equal(state.reviews.length,1);
  assert.equal(state.reviews[0].stars,5);
});

test('reported session messages survive 24h expiry and blocking severs social access',()=>{
  const now=Date.now(),state={messages:[{id:'old',kind:'session',at:now-90000000},{id:'evidence',kind:'session',at:now-90000000},{id:'private',kind:'private',at:0}],reportEvidence:[],blocked:[],friends:['bad','ok'],requests:['bad'],outgoingRequests:['bad'],party:['self','bad']};
  preserveReportEvidence(state,'evidence');
  expireSessionMessages(state,now);
  assert.deepEqual(state.messages.map(message=>message.id),['evidence','private']);
  blockUser(state,'bad');
  assert.deepEqual(state.blocked,['bad']);
  assert.deepEqual(state.friends,['ok']);
  assert.deepEqual(state.party,['self']);
});
