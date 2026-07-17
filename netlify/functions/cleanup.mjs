import { getTrustedApp } from './lib/trustedApp.mjs';

// Daily retention cleanup: expired session messages, released evidence,
// scheduled game deletions and stale launch state.
export default async () => {
  const { repository } = await getTrustedApp();
  const result = await repository.cleanupExpired({ now: Date.now() });
  console.log('cleanup', JSON.stringify(result));
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};

export const config = { schedule: '@daily' };
