import { getTrustedApp } from './lib/trustedApp.mjs';

export default async request => (await getTrustedApp()).trusted.fetch(request);

export const config = {
  path: ['/v1/*', '/health', '/.well-known/jwks.json']
};
