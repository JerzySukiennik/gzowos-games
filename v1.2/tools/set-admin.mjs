// Grant (or revoke) the platform admin claim for an account, and optionally
// take ownership of the seeded catalog.
// Usage:
//   FIREBASE_SERVICE_ACCOUNT="$(cat sa.json)" node tools/set-admin.mjs jurek@example.com
//   FIREBASE_SERVICE_ACCOUNT=... node tools/set-admin.mjs jurek@example.com --revoke
//   FIREBASE_SERVICE_ACCOUNT=... node tools/set-admin.mjs jurek@example.com --claim-catalog
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [email, ...flags] = process.argv.slice(2);
if (!email) { console.error('Usage: node tools/set-admin.mjs <email> [--revoke] [--claim-catalog]'); process.exit(1); }
const enabled = !flags.includes('--revoke');

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { admin: enabled });
await db.collection('admins').doc(user.uid).set({ admin: enabled });
await db.collection('audit').add({ action: 'admin-claim-set', actorId: 'tools/set-admin', targetId: user.uid, enabled, createdAt: new Date() });
console.log(`admin=${enabled} for ${email} (${user.uid}) — takes effect on next sign-in / token refresh`);

if (flags.includes('--claim-catalog')) {
  const seeded = await db.collection('games').where('ownerId', '==', 'gzowo-platform').get();
  for (const doc of seeded.docs) { await doc.ref.update({ ownerId: user.uid }); console.log('catalog owner set:', doc.id); }
}
process.exit(0);
