import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-error";
import { createApiClient } from "../create-api-client";
import type { ApiClientConfig } from "../types";

const BASE_URL = "https://api.test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeConfig(overrides: Partial<ApiClientConfig> = {}): ApiClientConfig {
  return {
    baseUrl: BASE_URL,
    getAccessToken: () => "access-1",
    getRefreshToken: () => "refresh-1",
    onTokenRefreshed: vi.fn(),
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

describe("createApiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends Authorization header and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const api = createApiClient(makeConfig());

    const result = await api("/me");

    expect(result).toEqual({ ok: true });
    const call = fetchMock.mock.calls[0]!;
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/me`);
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("sets Content-Type: application/json when a body is present", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const api = createApiClient(makeConfig());

    await api("/items", { method: "POST", body: JSON.stringify({ name: "x" }) });

    const call = fetchMock.mock.calls[0]!;
    const init = call[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("omits Content-Type when there is no body (e.g. bare DELETE)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createApiClient(makeConfig());

    await api("/items/1", { method: "DELETE" });

    const call = fetchMock.mock.calls[0]!;
    const init = call[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("omits Content-Type when body is FormData", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ uploaded: true }));
    const api = createApiClient(makeConfig());
    const fd = new FormData();
    fd.append("file", new Blob(["x"]));

    await api("/upload", { method: "POST", body: fd });

    const call = fetchMock.mock.calls[0]!;
    const init = call[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createApiClient(makeConfig());
    const result = await api("/delete-me");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with status + body on non-OK", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Forbidden", code: "X" }, 403),
    );
    const api = createApiClient(makeConfig());

    await expect(api("/admin")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Forbidden",
      body: { message: "Forbidden", code: "X" },
    });
  });

  it("falls back through message → error → HTTP <status>", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 502 }));
    const api = createApiClient(makeConfig());
    await expect(api("/x")).rejects.toMatchObject({ message: "HTTP 502" });
  });

  it("refreshes once on 401, retries with new token", async () => {
    const onTokenRefreshed = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "access-2", refresh_token: "refresh-2" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const api = createApiClient(makeConfig({ onTokenRefreshed }));
    const result = await api("/protected");

    expect(result).toEqual({ ok: true });
    expect(onTokenRefreshed).toHaveBeenCalledWith({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
    const retryCall = fetchMock.mock.calls[2]!;
    const retryInit = retryCall[1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe(
      "Bearer access-2",
    );
  });

  it("calls onUnauthorized when refresh fails", async () => {
    const onUnauthorized = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const api = createApiClient(makeConfig({ onUnauthorized }));

    await expect(api("/protected")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does NOT fire onError on the 401→unauthorized path", async () => {
    const onError = vi.fn();
    const onUnauthorized = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const api = createApiClient(makeConfig({ onError, onUnauthorized }));
    await expect(api("/x")).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("fires onError BEFORE throwing on non-OK", async () => {
    const onError = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500));
    const api = createApiClient(makeConfig({ onError }));

    await expect(api("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onError).toHaveBeenCalledOnce();
    const errCall = onError.mock.calls[0]!;
    expect(errCall[0]).toMatchObject({ status: 500 });
  });

  it("wraps network failures as ApiError(0)", async () => {
    const onError = vi.fn();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const api = createApiClient(makeConfig({ onError }));

    await expect(api("/x")).rejects.toMatchObject({
      status: 0,
      message: "Failed to fetch",
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("honors custom refresh field names", async () => {
    const onTokenRefreshed = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ jwt: "new-access", rt: "new-refresh" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const api = createApiClient(
      makeConfig({
        onTokenRefreshed,
        refreshPath: "/oauth/token",
        refreshRequestField: "refresh",
        accessTokenField: "jwt",
        refreshTokenField: "rt",
      }),
    );

    await api("/x");

    const refreshCall = fetchMock.mock.calls[1]!;
    expect(refreshCall[0]).toBe(`${BASE_URL}/oauth/token`);
    const refreshInit = refreshCall[1] as { body: string };
    expect(JSON.parse(refreshInit.body)).toEqual({
      refresh: "refresh-1",
    });
    expect(onTokenRefreshed).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("skips refresh entirely when no token is present", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const onUnauthorized = vi.fn();
    const api = createApiClient(
      makeConfig({ getAccessToken: () => null, onUnauthorized }),
    );

    await expect(api("/x")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
