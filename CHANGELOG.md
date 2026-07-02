# @idevconn/api-client

## 0.3.1

### Patch Changes

- f332e44: Fix: don't set `Content-Type: application/json` when a request has no body. Previously this was set on every request without an explicit `Content-Type`, including bodyless calls like `api('/items/1', { method: 'DELETE' })`. Strict JSON body parsers (e.g. Fastify's default) reject `Content-Type: application/json` on an empty body with a 400, which broke every bodyless DELETE for consumers of this client.

## 0.3.0

### Minor Changes

- 95bcb95: Initial release.

  Tiny JWT fetch wrapper with automatic token refresh, typed errors (`ApiError`
  with `status` + `body`), and pluggable callbacks (`onTokenRefreshed`,
  `onUnauthorized`, optional `onError` notifier). Wraps network failures as
  `ApiError(0, …)` so nothing is silent. Configurable refresh endpoint + field
  names. Framework-agnostic, zero runtime dependencies.
