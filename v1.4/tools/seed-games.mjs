// Seed the Firestore games catalog from the bundled demo catalog.
// Usage: FIREBASE_SERVICE_ACCOUNT="$(cat sa.json)" node tools/seed-games.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const games = [
  { id: 'bowling', title: 'Gzowo Bowling', url: 'https://jerzysukiennik.github.io/gzowo-bowling/', ageRating: 'E', tags: ['Arcade', 'Party'], players: 6 },
  { id: '2049', title: 'Gzowo 2049', url: 'https://jerzysukiennik.github.io/gzowo-2049/', ageRating: '13+', tags: ['Action', '3D'], players: 8 },
  { id: 'pogo-world', title: 'Pogo World', url: 'https://jerzysukiennik.github.io/pogo-world/', ageRating: 'E', tags: ['Parkour', 'Multiplayer'], players: 8 },
  { id: 'cruise-control', title: 'Cruise Control', url: 'https://jerzysukiennik.github.io/cruise-control/', ageRating: '13+', tags: ['Action', 'Arcade'], players: 3 },
  { id: 'untitled-pogo', title: 'Untitled Pogo Game', url: 'https://untitled-pogo-game.web.app/', ageRating: 'E', tags: ['Parkour', 'Co-op'], players: 8 },
  { id: 'raft', title: 'Raft', url: 'https://jerzysukiennik.github.io/raft/', ageRating: '13+', tags: ['Survival', 'Co-op'], players: 8 },
  { id: 'viewfinder', title: 'Viewfinder', url: 'https://jerzysukiennik.github.io/viewfinder/', ageRating: 'E', tags: ['Puzzle', '3D'], players: 1 },
  { id: 'backrooms', title: 'Backrooms Labyrinth', url: 'https://jerzysukiennik.github.io/backrooms-labirynth/', ageRating: '13+', tags: ['Horror', 'Co-op'], players: 8 }
];

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore(app);
const ownerId = process.env.GG_CATALOG_OWNER || 'gzowo-platform';
for (const game of games) {
  const { id, ...fields } = game;
  await db.collection('games').doc(id).set({
    ...fields,
    ownerId,
    status: 'published',
    visibility: 'visible',
    // Honest: no game has completed a server-verified GG SDK handshake on its
    // deployed URL yet, so launches stay blocked until each passes.
    sdkPassed: false,
    origin: new URL(game.url).origin,
    publishedAt: '2026-07-17'
  }, { merge: true });
  console.log('seeded', id);
}
process.exit(0);
