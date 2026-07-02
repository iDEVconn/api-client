import { ApiError } from "./api-error";
import type { ApiClient, ApiClientConfig } from "./types";

const DEFAULTS = {
  refreshPath: "/auth/refresh",
  refreshRequestField: "refresh_token",
  accessTokenField: "access_token",
  refreshTokenField: "refresh_token",
} as const;

export function createApiClient(config: ApiClientConfig): ApiClient {
  const cfg = { ...DEFAULTS, ...config };

  async function refresh(): Promise<string | null> {
    const refreshToken = cfg.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${cfg.baseUrl}${cfg.refreshPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cfg.refreshRequestField]: refreshToken }),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as Record<string, unknown>;
      const nextAccess = data[cfg.accessTokenField];
      const nextRefresh = data[cfg.refreshTokenField];
      if (typeof nextAccess !== "string" || typeof nextRefresh !== "string") {
        return null;
      }
      cfg.onTokenRefreshed({
        accessToken: nextAccess,
        refreshToken: nextRefresh,
      });
      return nextAccess;
    } catch {
      return null;
    }
  }

  return async function api<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = cfg.getAccessToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (
      options.body !== undefined &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}${path}`, { ...options, headers });
    } catch (cause) {
      const err = new ApiError(
        0,
        null,
        cause instanceof Error ? cause.message : "Network error",
      );
      cfg.onError?.(err);
      throw err;
    }

    if (res.status === 401 && token) {
      const newToken = await refresh();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        try {
          res = await fetch(`${cfg.baseUrl}${path}`, { ...options, headers });
        } catch (cause) {
          const err = new ApiError(
            0,
            null,
            cause instanceof Error ? cause.message : "Network error",
          );
          cfg.onError?.(err);
          throw err;
        }
      } else {
        cfg.onUnauthorized();
        throw new ApiError(401, null, "Unauthorized");
      }
    }

    if (res.status === 401 && token) {
      cfg.onUnauthorized();
      throw new ApiError(401, null, "Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as unknown);
      const message =
        (body as { message?: string; error?: string })?.message ??
        (body as { message?: string; error?: string })?.error ??
        `HTTP ${res.status}`;
      const err = new ApiError(res.status, body, message);
      cfg.onError?.(err);
      throw err;
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };
}
