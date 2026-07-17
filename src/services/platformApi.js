import { firebaseAuth } from './firebase.js';

const baseUrl = String(import.meta.env.VITE_GG_API_URL || '').replace(/\/$/, '');

async function request(path, { method = 'POST', body } = {}) {
  if (!baseUrl) throw new Error('Trusted API is not configured');
  const token = await firebaseAuth.idToken();
  if (!token) throw new Error('Sign in is required for the trusted API');
  const response = await fetch(`${baseUrl}${path}`, { method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',referrerPolicy:'no-referrer' });
  const value = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(value.error || `Trusted API request failed (${response.status})`);
  return value;
}

export const platformApi = {
  configured: Boolean(baseUrl),
  launch(payload) { return request('/v1/launch-tokens',{body:payload}); },
  onboard(dateOfBirth,parentEmail) { return request('/v1/onboarding/age-band',{body:{dateOfBirth,parentEmail}}); },
  createReport(payload) { return request('/v1/reports',{body:payload}); },
  createSdkCheck(gameId,url) { return request('/v1/sdk-checks',{body:{gameId,url}}); },
  getSdkCheck(id) { return request(`/v1/sdk-checks/${encodeURIComponent(id)}`,{method:'GET'}); },
  claimSdkCheck(id,payload) { return request(`/v1/sdk-checks/${encodeURIComponent(id)}/claim`,{body:payload}); },
  createThread(members,name) { return request('/v1/threads',{body:{members,name}}); },
  sendMessage(threadId,text,kind) { return request(`/v1/threads/${encodeURIComponent(threadId)}/messages`,{body:{text,kind}}); }
  ,approveParentConsent(childUid) { return request(`/v1/parent-consents/${encodeURIComponent(childUid)}/approve`,{body:{}}); }
  ,moderateReport(reportId,action) { return request(`/v1/admin/reports/${encodeURIComponent(reportId)}/moderate`,{body:{action}}); }
};
