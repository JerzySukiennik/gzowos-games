# Gzowo's Games

A dark, desktop-first social game dashboard for discovering independent games, seeing friends online and joining the same session. The complete demo works locally with persistent browser data and no account, API key or paid service.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts both services automatically: Bowling v1.9 at `http://127.0.0.1:8099/` and the dashboard at the address shown by Vite. The dashboard receives the local Bowling URL without an `.env` file, so joining Mila opens the real v1.9 controller flow. Ctrl+C shuts down both services.

To run only the dashboard against the production Bowling fallback or a URL supplied in `.env`, use:

```bash
npm run dev:dashboard
```

Choose the player or administrator demo explicitly. The administrator demo exposes moderation for review; the player demo proves it is role-gated. Use **Settings → Reset demo** to restore the initial state. `npm run check` runs the tests and production build.

## Included in v1

- Persistent local demo for catalog, search, filters, favorites, 1–5 star reviews with optional text, recently played and age gates.
- Friends, requests, exact username/name discovery demo, invite link and QR, 50-friend limit, presence, privacy, invisible mode, parties and joinable sessions up to eight players.
- Private/group messages, session-message expiry model, emoji/text, safe-link interstitial, no image attachments and report context.
- Creator submissions with required title/URL/age fields, a real origin-bound SDK handshake, admin approval, publishing, automatic updates, hide/show and delayed deletion lifecycle.
- Moderation queue, warning/mute/suspend/ban/dismiss actions and persistent audit log.
- Profile, custom local avatar, permanent username/editable display name, bio, English/hand-written Polish toggle, parental fields, JSON export and account deletion/reset.
- Mandatory open-source browser SDK with docs and example in `sdk/`.
- Dependency-free trusted Node/Fetch API reference with ES256 launch signing, one-use launch channels, backend SDK challenges, server-derived age bands, trusted chat/moderation, evidence retention, cleanup and a pinned-DNS game URL monitor in `server/`.
- Optional Firebase Spark adapter with live Firestore/Realtime Database subscriptions, Storage avatar upload and deny-by-default rules templates for Auth-backed social data.
- Eight real Gzowo game URLs in the catalog. Only SDK-verified games can launch; unintegrated games are visibly marked **SDK pending** instead of using fake destinations.

## Firebase Spark mode (optional)

Copy `.env.example` to `.env`, create a Firebase web app and fill its public web configuration. Enable Email/Password and Google providers in Firebase Authentication. The dashboard dynamically enables those providers; without configuration it remains fully usable in local mode.

Set `VITE_GG_API_URL` to the trusted API origin to require backend-issued launch tokens, backend-derived age bands and server-side report evidence. When configured, a token failure fails closed; the frontend does not silently fall back to its unsigned demo token. The launch popup is still created synchronously before the API request so browser popup blocking does not break the signed flow.

Apple sign-in is visible but intentionally does not pretend to work: Firebase support still requires Apple Developer Program configuration, a Services ID, key and return URL. No Apple credentials are included.

The rules expect a trusted `ageBands/{uid}` Firestore document and matching Realtime Database age-band entry. Under-13 friend acceptance and chat then fail closed unless the verified parent explicitly approves them. Only trusted administration may provision age bands or administrator claims.

The repository now includes an OSS trusted-handler reference for signed one-use launch tokens, age-band/admin provisioning, verified parent approval, trusted chat/moderation, preserved report evidence, cleanup and pinned-DNS URL monitoring. A public service still needs a free host adapter, durable Firebase Admin repository, secret/key rotation, scheduled calls, parental-consent email delivery, link reputation checks and production rate limits. Those cannot be made secure purely in an untrusted browser.

See [AUDIT.md](./AUDIT.md) for the exact boundary between locally proven behavior and production work that still requires external configuration.

## Free and open-source

Project code is MIT licensed. Runtime dependencies are Firebase's Apache-2.0 JavaScript SDK and QRCode's MIT library. Vite is MIT. The UI uses system fallbacks if the optional Google-hosted Archivo and IBM Plex Mono fonts are unavailable. For a fully self-hosted deployment, download their OFL font files and replace the CSS import with local `@font-face` declarations.

No deployment or remote repository is created by this project.
