# @idevconn/api-client

## 0.3.0

### Minor Changes

- 95bcb95: Initial release.

  Tiny JWT fetch wrapper with automatic token refresh, typed errors (`ApiError`
  with `status` + `body`), and pluggable callbacks (`onTokenRefreshed`,
  `onUnauthorized`, optional `onError` notifier). Wraps network failures as
  `ApiError(0, …)` so nothing is silent. Configurable refresh endpoint + field
  names. Framework-agnostic, zero runtime dependencies.
