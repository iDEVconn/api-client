# @idevconn/api-client

Tiny JWT fetch wrapper with automatic token refresh, typed errors, and pluggable callbacks. Framework-agnostic. Zero runtime dependencies.

## Features

- Auto-injects `Authorization: Bearer <token>` from your auth store.
- Retries once on 401 via a configurable refresh endpoint.
- Surfaces failures as a typed `ApiError` with `status`, `body`, and `message`.
- Wraps network failures (`fetch` reject) as `ApiError(0, …)` — never silent.
- Optional global `onError` notifier for crash reporting / default toasts.
- Skips `Content-Type` when sending `FormData` (browser sets the boundary).
- Returns `undefined` for `204 No Content`.

## Install

```bash
npm install @idevconn/api-client
```

## Quick start

```ts
import { createApiClient, ApiError } from "@idevconn/api-client";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,

  getAccessToken: () => authStore.getState().accessToken,
  getRefreshToken: () => authStore.getState().refreshToken,

  onTokenRefreshed: ({ accessToken, refreshToken }) =>
    authStore.getState().setAuth({ accessToken, refreshToken }),

  onUnauthorized: () => {
    authStore.getState().logout();
    window.location.href = "/login";
  },

  // Optional. Fires on every non-OK response and every network failure,
  // BEFORE the error is thrown. Does NOT fire on the 401→onUnauthorized path.
  onError: (err) => reportToCrashlytics(err, { status: err.status, body: err.body }),
});

// Usage
try {
  const me = await api<{ id: string }>("/me");
} catch (err) {
  if (err instanceof ApiError && err.status === 403) {
    showUpgradeModal();
  }
}
```

## Configuration

| Field                 | Type                                                     | Required | Default            | Notes                                                                                                |
| --------------------- | -------------------------------------------------------- | -------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `baseUrl`             | `string`                                                 | yes      | —                  | Prepended to every request path.                                                                     |
| `getAccessToken`      | `() => string \| null`                                   | yes      | —                  | Read the current token from your store on each call (don't cache).                                   |
| `getRefreshToken`     | `() => string \| null`                                   | yes      | —                  | Same.                                                                                                |
| `onTokenRefreshed`    | `({ accessToken, refreshToken }) => void`                | yes      | —                  | Persist new tokens to your store. Called after a successful refresh.                                 |
| `onUnauthorized`      | `() => void`                                             | yes      | —                  | Called when refresh fails after a 401. Typically clears auth + redirects to login.                   |
| `onError`             | `(err: ApiError) => void`                                | no       | —                  | Global error notifier. Fires for non-OK responses + network failures (NOT the 401→unauthorized path). |
| `refreshPath`         | `string`                                                 | no       | `/auth/refresh`    | Endpoint hit when refreshing.                                                                        |
| `refreshRequestField` | `string`                                                 | no       | `refresh_token`    | Body field name sent to the refresh endpoint.                                                        |
| `accessTokenField`    | `string`                                                 | no       | `access_token`     | Response field name carrying the new access token.                                                   |
| `refreshTokenField`   | `string`                                                 | no       | `refresh_token`    | Response field name carrying the new refresh token.                                                  |

## `ApiError`

```ts
class ApiError extends Error {
  readonly status: number;       // 0 for network failures
  readonly body: unknown;         // parsed JSON response (or null)
  get isNetworkError(): boolean;  // status === 0
}
```

Status code, response body, and `instanceof` work in `catch` blocks and React Query `onError` handlers.

## Error-handling semantics

| Scenario                              | `onError` fires? | `onUnauthorized` fires? | Throws?         |
| ------------------------------------- | ---------------- | ----------------------- | --------------- |
| 2xx with body                          | no               | no                      | no (returns body) |
| 204                                    | no               | no                      | no (returns `undefined`) |
| 4xx / 5xx                              | **yes**          | no                      | yes (`ApiError`) |
| 401, refresh succeeds, retry OK        | no               | no                      | no (returns body) |
| 401, refresh fails (or no refresh tok) | no               | **yes**                 | yes (`ApiError(401)`) |
| Network failure / `fetch` reject       | **yes**          | no                      | yes (`ApiError(0)`) |

The `onError` callback runs **before** the throw — your `try/catch` and React Query `onError` still run after it.

## License

Apache-2.0
