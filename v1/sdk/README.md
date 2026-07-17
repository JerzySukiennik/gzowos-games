# Gzowo's Games SDK v2

The mandatory MIT-licensed browser SDK gives a hosted game a minimal age-banded identity, party data, presence and joinable sessions. It never receives a password, email or exact date of birth.

## Production integration

```js
import { createSDK } from '@gzowos-games/sdk';

const gg = createSDK({
  gameId: 'my-game',
  parentOrigin: 'https://games.example',
  jwksUrl: 'https://games.example/.well-known/jwks.json'
});

const { profile, party } = await gg.init();
gg.setPresence('playing', { joinable: true, sessionId: 'room-42' });
gg.createSession({ id: 'room-42', maxPlayers: 8, joinData: { room: '42' } });
```

Production launches use a compact ES256 JWS in `#ggLaunch=...`. The fragment keeps the token out of the hosted game's HTTP request, access logs and referrer. SDK v2 fetches the platform JWKS, requires `alg=ES256` and a known `kid`, verifies the signature, issuer, audience, game ID, exact game origin and a maximum five-minute lifetime before exposing the launch profile.

Unsigned v1 payloads are rejected by default. A local game may explicitly use them only on `localhost`:

```js
const gg = createSDK({ gameId: 'my-game', allowUnsignedDev: true });
await gg.init({ launchToken: localUnsignedToken });
```

Do not enable `allowUnsignedDev` in a deployed game. The SDK accepts a legacy query token only in that explicit localhost mode.

## Protocol

- `ready`: verified handshake and protocol version.
- `presence`: `online`, `playing` or `offline`; no arbitrary public payload.
- `session`: session ID, constrained join data and a hard maximum of eight players.
- `leave`: removes the active presence/session record.

Cross-origin games use `window.opener.postMessage` with exact platform/game origins and a nonce. Same-origin games additionally use a nonce-scoped `BroadcastChannel`. Games should call `destroy()` when unloading.
