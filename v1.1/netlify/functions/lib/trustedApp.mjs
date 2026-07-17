import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { webcrypto } from 'node:crypto';
import { createApp } from '../../../server/app.js';
import { createTokenAuthenticator } from '../../../server/auth.js';
import { importES256PrivateJwk } from '../../../server/crypto/jws.js';
import { FirestoreRepository } from '../../../server/repository/firestoreAdmin.js';
import { createNodePinnedTransport } from '../../../server/security/nodePinnedFetch.js';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

let cached;
export async function getTrustedApp() {
  if (cached) return cached;
  const serviceAccount = JSON.parse(required('FIREBASE_SERVICE_ACCOUNT'));
  const app = getApps()[0] || initializeApp({
    credential: cert(serviceAccount),
    databaseURL: required('FIREBASE_DATABASE_URL')
  });
  const auth = getAuth(app);
  const repository = new FirestoreRepository({
    firestore: getFirestore(app),
    rtdb: getDatabase(app),
    timestampFromMillis: millis => Timestamp.fromMillis(millis)
  });
  const keyMaterial = JSON.parse(required('GG_SIGNING_KEY'));
  const signingKey = {
    kid: keyMaterial.kid,
    privateKey: await importES256PrivateJwk(keyMaterial.privateJwk),
    // Extractable so createJwks() can publish the public JWK.
    publicKey: await webcrypto.subtle.importKey('jwk', keyMaterial.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
  };
  const trusted = createApp({
    authenticate: createTokenAuthenticator({ verifyIdToken: token => auth.verifyIdToken(token) }),
    repository,
    signingKey,
    issuer: required('GG_ISSUER'),
    platformOrigin: required('GG_PLATFORM_ORIGIN'),
    monitorTransport: createNodePinnedTransport(),
    adminBootstrap: {
      secret: required('GG_BOOTSTRAP_SECRET'),
      allowedUids: (process.env.GG_BOOTSTRAP_UIDS || '').split(',').map(item => item.trim()).filter(Boolean),
      setAdminClaim: (uid, enabled) => auth.setCustomUserClaims(uid, { admin: Boolean(enabled) })
    }
  });
  cached = { trusted, repository };
  return cached;
}
