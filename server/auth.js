export function bearerToken(request) {
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Authentication required'), { status: 401 });
  return match[1];
}

export function createTokenAuthenticator({ verifyIdToken }) {
  if (typeof verifyIdToken !== 'function') throw new Error('verifyIdToken is required');
  return async request => {
    const claims = await verifyIdToken(bearerToken(request));
    if (!claims?.uid && !claims?.sub) throw Object.assign(new Error('Invalid identity token'), { status: 401 });
    return {
      uid: claims.uid || claims.sub,
      name: claims.name || claims.displayName || 'Player',
      avatar: claims.picture || claims.avatar || null,
      admin: claims.admin === true,
      email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null,
      emailVerified: claims.email_verified === true
    };
  };
}

export function requireAdmin(principal) {
  if (!principal?.admin) throw Object.assign(new Error('Administrator permission required'), { status: 403 });
}
