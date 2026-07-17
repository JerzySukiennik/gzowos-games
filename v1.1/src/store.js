import { games, people, seedReviews } from './data.js';

const KEY = 'gg-v1-state';
const defaults = {
  version: 1,
  user: { id: 'local-jurek', email: 'jurek@example.com', username: 'jurek', displayName: 'Jurek', bio: 'Building strange, playable things.', dob: '2000-01-01', avatar: '', role: 'admin', parentEmail: '', parentConsent: true, onboarded: true },
  auth: { signedIn: false, provider: null, demoRole: null },
  settings: { language: 'en', invisible: false, showStatus: true, showFriends: true, joinPrivacy: 'friends', notifications: { messages: true, friends: true, invites: true, creator: true }, chatEnabled: true },
  favorites: ['bowling', 'pogo-world'], recently: ['bowling'], friends: ['mila', 'kuba', 'lena', 'alex'], requests: ['oli'], outgoingRequests: [], blocked: [],
  friendApprovalQueue: [],
  reviews: seedReviews,
  reportEvidence: [],
  gameStats: {},
  analytics: { launches: [], sdkErrors: [], joins: [] },
  messages: [
    { id: 'm1', thread: 'mila', from: 'mila', text: 'One more round of Bowling?', at: Date.now() - 480000, kind: 'private' },
    { id: 'm2', thread: 'mila', from: 'local-jurek', text: 'Give me two minutes 🎳', at: Date.now() - 420000, kind: 'private' },
    { id: 'm3', thread: 'party', from: 'kuba', text: 'Mars after this?', at: Date.now() - 240000, kind: 'group' }
  ],
  threadIds: {},
  party: ['local-jurek', 'mila', 'kuba'],
  notifications: [
    { id: 'n1', text: 'Oli sent you a friend request.', type: 'friend', read: false, at: Date.now() - 1800000 },
    { id: 'n2', text: 'Gzowo Bowling passed its latest SDK check.', type: 'creator', read: false, at: Date.now() - 7200000 }
  ],
  submissions: [
    { id: 's1', title: 'Orbit Run', url: 'https://example.com/orbit-run', age: 'E', ageRating: 'E', notes: 'Fast orbital puzzle. SDK handshake included.', status: 'submitted', owner: 'mila_builds', sdk: true, sdkPassed: true, created: '2026-07-15' },
    { id: 's2', title: 'Tiny Foundry', url: 'https://example.com/foundry', age: '13+', notes: 'Automation prototype.', status: 'requiredChanges', owner: 'jurek', sdk: false, created: '2026-07-12' }
  ],
  moderation: [
    { id: 'mod1', target: 'Message by pixelWolf', reason: 'Unsafe link', context: 'free-robux.example', status: 'open', created: '2026-07-16' },
    { id: 'mod2', target: 'Backrooms Labyrinth', reason: 'Age rating review', context: 'User report with session evidence', status: 'open', created: '2026-07-15' }
  ],
  audit: [{ id: 'a1', action: 'Published Gzowo Bowling', by: 'jurek', at: Date.now() - 86400000 }]
};

export const loadState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return parsed?.version === 1 ? { ...structuredClone(defaults), ...parsed } : structuredClone(defaults);
  } catch { return structuredClone(defaults); }
};

export const saveState = state => localStorage.setItem(KEY, JSON.stringify(state));
export const resetState = () => { localStorage.removeItem(KEY); location.reload(); };
export const allGames = () => games;
export const catalogGames = state => {
  const seeded = games.map(game => ({ ...game, ...(state?.gameStats?.[game.id] || {}) }));
  const community = [...new Map([...(state?.submissions || []),...(state?.cloudGames || [])].map(game=>[game.id,game])).values()];
  const submitted = community
    .filter(game => game.status === 'published' && game.visibility !== 'hidden' && (!game.deleteAt || game.deleteAt > Date.now()))
    .filter(game => !seeded.some(seed => seed.id === game.id))
    .map(game => ({
      id: game.id,
      title: game.title,
      creator: game.owner || 'Independent creator',
      age: game.ageRating || game.age || 'E',
      tags: Array.isArray(game.tags) && game.tags.length ? game.tags.slice(0, 5) : ['Indie'],
      players: Math.max(1, Math.min(8, Number(game.players) || 8)),
      active: Number(game.active) || 0,
      rating: Number(game.rating) || 0,
      reviews: Number(game.reviews) || 0,
      color: game.color || '#7486FF',
      glyph: game.glyph || game.title.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase(),
      description: game.description || game.notes || 'An independent game published through Gzowo’s Games.',
      url: game.url,
      sdkReady: true,
      created: game.publishedAt || game.updated || game.created,
      featured: Boolean(game.featured)
    }));
  return [...seeded, ...submitted].map(game=>{const reviews=(state?.reviews||[]).filter(review=>review.gameId===game.id);if(reviews.length)return {...game,rating:Number((reviews.reduce((sum,review)=>sum+Number(review.stars||0),0)/reviews.length).toFixed(1)),reviews:reviews.length};return {...game,rating:0,reviews:0};});
};
export const allPeople = () => people;
export const isUnder = (dob, age) => dob && ((Date.now() - new Date(dob).getTime()) / 31557600000) < age;
export const canPlay = (user, game) => game.age === 'E' || (game.age === '13+' && !isUnder(user.dob, 13)) || (game.age === '18+' && !isUnder(user.dob, 18));
export const safeUrl = raw => {
  try {
    const url = new URL(raw);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const blocked = ['javascript:', 'data:', 'file:'].includes(url.protocol) || /(^|\.)(bit\.ly|tinyurl\.com|free-robux\.example|xn--)/i.test(url.hostname) || url.href.length > 2048;
    return { ok: !blocked && (url.protocol === 'https:' || (local && url.protocol === 'http:')), url };
  } catch { return { ok: false }; }
};
export const formatTime = value => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value);
