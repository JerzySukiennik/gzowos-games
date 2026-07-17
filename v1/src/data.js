const bowlingUrl = import.meta.env?.VITE_BOWLING_URL || 'https://jerzysukiennik.github.io/gzowo-bowling/';
export const games = [
  { id: 'bowling', title: 'Gzowo Bowling', creator: 'Gzowo', age: 'E', tags: ['Arcade', 'Party'], players: 6, active: 1, rating: 4.8, reviews: 126, color: '#7486FF', glyph: 'GB', description: 'A neon bowling night built for quick rounds, clean throws and loud couch rivalries.', url: bowlingUrl, sdkReady: true, featured: true, created: '2026-07-02' },
  { id: '2049', title: 'Gzowo 2049', creator: 'Gzowo', age: '13+', tags: ['Action', '3D'], players: 8, active: 0, rating: 4.6, reviews: 74, color: '#DD7DFF', glyph: '49', description: 'An open robot city where voice, AI characters and multiplayer collide.', url: 'https://jerzysukiennik.github.io/gzowo-2049/', sdkReady: false, featured: true, created: '2026-07-13' },
  { id: 'pogo-world', title: 'Pogo World', creator: 'Gzowo', age: 'E', tags: ['Parkour', 'Multiplayer'], players: 8, active: 0, rating: 4.7, reviews: 0, color: '#FF8B62', glyph: 'PW', description: 'A physics-first pogo playground with three connected zones and multiplayer.', url: 'https://jerzysukiennik.github.io/pogo-world/', sdkReady: false, featured: true, created: '2026-07-16' },
  { id: 'cruise-control', title: 'Cruise Control', creator: 'Gzowo', age: '13+', tags: ['Action', 'Arcade'], players: 3, active: 0, rating: 4.5, reviews: 0, color: '#5FCCA6', glyph: 'CC', description: 'Fly as a missile through obstacle courses and finish with a voxel explosion.', url: 'https://jerzysukiennik.github.io/cruise-control/', sdkReady: false, created: '2026-07-16' },
  { id: 'untitled-pogo', title: 'Untitled Pogo Game', creator: 'Gzowo', age: 'E', tags: ['Parkour', 'Co-op'], players: 8, active: 0, rating: 4.6, reviews: 0, color: '#58A9E8', glyph: 'UP', description: 'Fifteen compact pogo levels built for co-op runs on web and desktop.', url: 'https://untitled-pogo-game.web.app/', sdkReady: false, created: '2026-07-13' },
  { id: 'raft', title: 'Raft', creator: 'Gzowo', age: '13+', tags: ['Survival', 'Co-op'], players: 8, active: 0, rating: 4.4, reviews: 68, color: '#4E9BCB', glyph: 'RF', description: 'Survive a wide ocean, build a tiny home and keep your friends aboard.', url: 'https://jerzysukiennik.github.io/raft/', sdkReady: false, created: '2026-06-01' },
  { id: 'viewfinder', title: 'Viewfinder', creator: 'Gzowo', age: 'E', tags: ['Puzzle', '3D'], players: 1, active: 0, rating: 4.5, reviews: 41, color: '#95A38D', glyph: 'VF', description: 'Turn flat images into physical paths and reshape the level through your camera.', url: 'https://jerzysukiennik.github.io/viewfinder/', sdkReady: false, created: '2026-07-10' },
  { id: 'backrooms', title: 'Backrooms Labyrinth', creator: 'Gzowo', age: '13+', tags: ['Horror', 'Co-op'], players: 8, active: 0, rating: 4.3, reviews: 105, color: '#D7C65D', glyph: 'BL', description: 'Stay together. Mark the walls. The corridors remember where you have been.', url: 'https://jerzysukiennik.github.io/backrooms-labirynth/', sdkReady: false, created: '2026-07-03' }
];

export const people = [
  { id: 'mila', name: 'Mila', username: 'mila_builds', status: 'playing', game: 'Gzowo Bowling', gameId: 'bowling', sessionId: 'bowl-mila-MILA', joinData: { lane: 4, room: 'MILA' }, joinable: true, avatar: '#FF8B62', profilePublic: true, showFriends: true, mutualFriends: ['kuba'], publishedGames: ['Orbit Run'] },
  { id: 'kuba', name: 'Kuba', username: 'kubson', status: 'online', avatar: '#5FCCA6' },
  { id: 'lena', name: 'Lena', username: 'lena.exe', status: 'offline', avatar: '#DD7DFF' },
  { id: 'alex', name: 'Alex', username: 'alex_in_flight', status: 'playing', game: 'Cruise Control', gameId: 'cruise-control', sessionId: 'cruise-alex-7', joinData: { lobby: 'A7' }, joinable: false, avatar: '#58A9E8' },
  { id: 'oli', name: 'Oli', username: 'oliverse', status: 'online', avatar: '#D7C65D' }
];

export const seedReviews = [
  { id: 'r1', gameId: 'bowling', user: 'Mila', stars: 5, text: 'The spare camera is ridiculously satisfying.', date: '2026-07-14' },
  { id: 'r2', gameId: 'cruise-control', user: 'Kuba', stars: 5, text: 'Fast, chaotic and very good at making one more run happen.', date: '2026-07-13' }
];
