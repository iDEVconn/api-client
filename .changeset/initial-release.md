---
"@idevconn/api-client": minor
---

Initial release.

Tiny JWT fetch wrapper with automatic token refresh, typed errors (`ApiError`
with `status` + `body`), and pluggable callbacks (`onTokenRefreshed`,
`onUnauthorized`, optional `onError` notifier). Wraps network failures as
`ApiError(0, …)` so nothing is silent. Configurable refresh endpoint + field
names. Framework-agnostic, zero runtime dependencies.
