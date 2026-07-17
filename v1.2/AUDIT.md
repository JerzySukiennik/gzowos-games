# Gzowo's Games — implementation audit

Audited 2026-07-17. This file separates evidence from intent; “implemented” never means “live on the public internet”.

## Proven locally

- Dark, responsive EN/PL dashboard with catalog, search, filters, profiles, settings and role-gated administration.
- Favorites and one 1–5-star review per user/game, with optional text and real review-derived averages.
- Friends, requests, blocking, parties, messages, session-message expiry and report-evidence preservation in the persistent demo model.
- Creator submission, origin-bound SDK verification, admin approval, publication, updates, hide/show and 30-day deletion scheduling.
- Real catalog URLs; launch is enabled only for games that completed SDK integration.
- Bowling v1.9 verifies ES256/JWKS claims, consumes each production launch once and joins the selected friend session without consuming again after its controller redirect. Bowling v1.8 remains unchanged.
- Firebase client adapters subscribe to profiles, games, reviews, friendships, threads, notifications, reports and presence; avatars use Storage.
- Trusted API reference covers one-use launch/event channels, backend SDK challenges, atomic identity/age provisioning, explicit chat policy, verified parent approval, moderation evidence, retention cleanup, admin bootstrap and pinned-DNS monitoring.
- Firestore and Realtime Database rules fail closed for trusted age bands, under-13 chat, parent-approved friends, reports, private identity writes and public presence.
- Automated result: 61/61 tests pass and the production bundle builds. Two independent review rounds found and drove fixes for the trusted reference; the final focused review findings are covered by regression tests.

## Live production state (2026-07-17, second pass)

- **Frontend LIVE:** https://jerzysukiennik.github.io/gzowos-games/ (GitHub Pages, Actions build; repo `JerzySukiennik/gzowos-games`).
- **Trusted API LIVE:** https://gzowos-games-api.netlify.app (Netlify Functions, Node 22 not required after pinning firebase-admin@13; ES256 JWKS at `/.well-known/jwks.json`). Secrets (service-account key, private signing JWK, bootstrap secret) live only in Netlify env vars.
- **Firebase project `gzowos-games`** (Spark, account gzowotesla): Auth with email/password + Google (auto-provisioned OAuth client), Firestore `(default)` in eur3 with deployed rules, RTDB `gzowos-games-default-rtdb` (europe-west1) with deployed rules, authorized domains include `jerzysukiennik.github.io`. RTDB `hasOnly` syntax errors were found by the real deploy (the emulator never ran) and fixed.
- **Durable repository:** `server/repository/firestoreAdmin.js` implements the whole trusted interface over firebase-admin Firestore + RTDB (atomic one-use JTI, event-channel sequencing, SDK challenges, evidence, retention cleanup). Scheduled daily cleanup runs as a Netlify scheduled function.
- **Catalog seeded** (8 games, `ownerId: gzowo-platform` until claimed): all honest `sdkPassed: false`, so `/v1/launch-tokens` correctly refuses launches until a game passes a real SDK check on its deployed URL.
- **Live E2E proof (two real accounts):** signup ×2, onboarding through the trusted API (identity + age band written server-side, mirrored to RTDB), returning-login rehydration, cloud catalog read, review write, favorites, cross-account presence, friend request → accept (+ RTDB `friendAccess` grant), private chat through the trusted API (thread policy checks, `messageIndex`), and launch correctly blocked with 403.

## Remaining before calling it fully shipped

- Admin: Jurek's own account does not exist yet. After he signs up, run `FIREBASE_SERVICE_ACCOUNT=... node tools/set-admin.mjs <email> --claim-catalog` (mint a fresh service-account key from the Firebase console/IAM if needed).
- Storage on Spark cannot create the default bucket (Blaze-only since 2024), so avatars fall back to an inline 96 px thumbnail stored in the profile document.
- Parent-consent approval requires the parent to verify their email (Settings → Verify email); parent-email *delivery* (telling the parent to sign up) is still manual — no free outbound email sender is configured.
- GG SDK integration on deployed game URLs (Bowling v1.9 is still local-only; live v1.8 has no bridge), then per-game SDK checks to unlock launches.
- Real playtest by Jurek; abuse/rate-limit hardening at the host level; Apple login still excluded by the zero-cost constraint.
- Netlify CLI production deploys return Forbidden on this account; deploys are published via draft + `restoreSiteDeploy` (works, but remember it in autodeploy flows).
