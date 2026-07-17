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

## Implemented but not live-proven

- Email/password and Google authentication after a real Firebase web configuration is supplied.
- Multi-device social sync, presence, parent controls, moderation and Storage after rules and indexes are deployed to a real Firebase project.
- Apple sign-in UI and adapter path after Apple Developer/Firebase provider configuration.

## Required before a public production launch

- Create/configure the Firebase project, OAuth providers, Firestore indexes, rules and Storage bucket, then run a two-account/two-device acceptance test.
- Connect the included trusted interfaces to a durable Firebase Admin repository, real ID-token/custom-claims adapter, secret store and free Node host.
- Schedule cleanup/monitor jobs and add parent-email and notification delivery.
- Integrate the GG SDK into every catalog game that should be launchable and perform real cross-origin checks on its deployed URL.
- Complete abuse/security testing, privacy/legal copy, backups and a deployment decision.
- Apple login cannot be guaranteed at zero cost because Apple requires its external developer configuration; it remains disabled until that is provided.

## Current release decision

The local product prototype and trusted backend reference are usable and verified. It is **not production-ready** because durable Firebase integration, provider credentials, emulator/real multi-user tests, secrets, scheduling and deployment are still external prerequisites. The Firebase emulator could not be started because its binary download stalled, so rules have no runtime-emulator proof in this environment.
