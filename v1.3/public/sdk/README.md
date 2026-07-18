# Gzowo's Games SDK v2

The mandatory MIT-licensed SDK verifies ES256 launch tokens, then exposes only a minimal age-banded profile, party, presence and joinable-session API. Passwords, email and exact date of birth are never shared.

Production tokens arrive in `#ggLaunch=...`, are checked against the platform JWKS and are valid for at most five minutes. Unsigned tokens are disabled except when a game explicitly opts into local development on `localhost`.

Full integration documentation and source are in `sdk/README.md` and `sdk/src/index.js` in the repository.
