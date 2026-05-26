import type { ApiError } from "./api-error";

export interface ApiClientConfig {
  /** Base URL prepended to every request path (e.g. `https://api.example.com`). */
  baseUrl: string;

  /** Returns the current access token, or `null` if the user is unauthenticated. */
  getAccessToken: () => string | null;

  /** Returns the current refresh token, or `null` if none is available. */
  getRefreshToken: () => string | null;

  /** Called after a successful refresh. Persist the new tokens in your auth store. */
  onTokenRefreshed: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => void;

  /** Called when a refresh fails after a 401 — typically clears auth and redirects to login. */
  onUnauthorized: () => void;

  /**
   * Optional global error notifier. Fires for every non-OK response and every
   * network failure, BEFORE the error is thrown to the caller. Does NOT fire on
   * the 401→`onUnauthorized` path (that has its own dedicated callback).
   *
   * Use it for centralized side-effects like crash reporting or default toasts.
   * Per-call error handling still happens via the thrown `ApiError`.
   */
  onError?: (error: ApiError) => void;

  /** Path appended to `baseUrl` for the refresh request. Default: `/auth/refresh`. */
  refreshPath?: string;

  /** Request body field name carrying the refresh token. Default: `refresh_token`. */
  refreshRequestField?: string;

  /** Response field name carrying the new access token. Default: `access_token`. */
  accessTokenField?: string;

  /** Response field name carrying the new refresh token. Default: `refresh_token`. */
  refreshTokenField?: string;
}

export type ApiClient = <T = unknown>(
  path: string,
  options?: RequestInit,
) => Promise<T>;
