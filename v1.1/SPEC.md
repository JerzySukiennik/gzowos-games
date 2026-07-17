# Gzowo's Games v1 specification

## Product contract

The product is a desktop-first web SPA. Games remain on creator-owned HTTPS URLs, open in a new tab and must implement the GG SDK. Every game has one owner. Every first publication requires admin approval; later hosted content may update automatically and is monitored. Title, URL, age rating and an SDK handshake are the submission minimum.

The visual system is deliberately restrained: Void `#090B10`, Deck `#121620`, Edge `#252C38`, Ink `#F3F5F8`, Muted `#98A2B3`, Pulse `#7486FF`, Archivo and IBM Plex Mono. The signature is the functional Dock-notch around quick play on narrow screens. The desktop rail remains the main navigation.

## Identity and safety

Email/password, Google and Apple are product options. Email verification is not required. Apple needs external Apple Developer configuration. Providers using the same verified email resolve to one product profile; production must link credentials through Firebase Auth rather than create duplicate social graphs. The initial username is both display name and permanent `@username`; only an administrator may repair it later. The display name, avatar and free-form bio remain editable.

Date of birth is private. Games receive only `U13`, `13-17` or `18+`. Ratings are Everyone, 13+ and 18+. Under-13 accounts require verified parental consent in production, restrict presence/join visibility to friends and cannot use an everyone-join policy. A parent can disable chat, approve friends and inspect friend/message history in the production data model.

The content policy excludes sexual content, real-money gambling and extreme material. The 18+ rating may cover strong fictional violence or language. Images are not permitted in chat. Links require an interstitial and unsafe addresses are blocked. Reports can target users, games, groups and exact messages with context.

## Social and game model

Friendship requires acceptance and is limited to 50. Discovery supports exact usernames, display names, links and QR. Presence is Offline, Online or Playing, plus joinability. Join privacy is Everyone, Friends or Nobody. Invisible mode suppresses presence and joining. Parties persist across games, while every game session is capped at eight players. A full session supports a wait-notification concept.

Private and group messages persist. Session chat expires after 24 hours except preserved report evidence. Notifications cover social, messages, invitations, creator decisions and moderation, with category settings.

Catalog sections include Featured, Friends playing, Popular, New and categories. Search covers title, owner and tags. Filters cover age, tags, devices and players. Ratings work like map reviews: 1–5 stars, optional text and favorites; submitting again updates the same user's review. Popularity uses active players, returns and likes rather than lifetime launches alone. Published community submissions join the same catalog and can be hidden or scheduled for deletion by their owner.

## Local demo versus production evidence

LocalStorage proves navigation, state transitions, persistence and interaction design only. It does not prove secure multi-user identity, email delivery, parental verification, global presence or abuse prevention. Demo administrator access is an explicit local choice. Firebase production moderation requires an administrator custom claim minted by trusted infrastructure; the client cannot grant it. The included trusted Fetch API reference signs short-lived ES256 SDK v2 tokens, derives age bands, preserves report evidence and provides cleanup/monitor routes. Production still has to connect its injected repository/auth interfaces to durable Firebase Admin infrastructure and a scheduler. SDK v1 demo tokens remain unsigned, localhost-only and must never authorize production data.

## Acceptance checks

- `npm test` covers age gates, safe links, SDK origin/nonce checks, publication lifecycle, review uniqueness, chat expiry evidence and product surfaces.
- `npm run build` produces a Vite production bundle without credentials.
- Manual smoke: search/filter/open/favorite/review a game; accept a friend; send a message; inspect a safe and blocked link; submit/approve/publish/hide a game; moderate a report; change PL/EN and profile; export/reset data; launch the SDK-integrated Bowling game and verify other real games remain disabled until integration.
