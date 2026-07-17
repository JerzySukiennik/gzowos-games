# Trusted API reference

`createApp()` is a dependency-free Fetch API handler for the security-sensitive parts of Gzowo's Games. The included monitor transport targets a free OSS Node host because it pins validated DNS answers into the TLS connection.

Implemented routes:

- `GET /.well-known/jwks.json`
- `POST /v1/launch-tokens`
- `POST /v1/launches/consume`
- `POST /v1/launches/events`
- `POST /v1/sdk-checks` and owner-scoped check/claim routes
- `POST /v1/onboarding/age-band`
- trusted thread/message and parent-consent routes
- `PUT /v1/admin/age-bands/:uid`
- `PUT /v1/admin/admins/:uid`
- `POST /v1/admin/bootstrap`
- `POST /v1/reports`
- trusted moderation routes
- `POST /v1/admin/cleanup`
- `POST /v1/admin/games/:id/monitor`

The handler requires injected `authenticate`, `repository` and ES256 key implementations. `createTokenAuthenticator()` adapts a Firebase Admin `verifyIdToken` function without adding the Firebase Admin package to the browser project. `MemoryRepository` is deterministic test infrastructure, not production storage.

Production must inject a durable repository backed by Firebase Admin or another OSS database, keep the private JWK in the host's secret store, rotate `kid` values, schedule cleanup/monitor calls and enforce host-level rate limits. The URL monitor rejects non-HTTPS URLs, credentials, local/internal names, private/reserved IPv4/IPv6 and revalidates every redirect. `createNodePinnedTransport()` pins the validated address while retaining TLS SNI and certificate verification.
