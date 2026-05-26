import { describe, expect, it } from "vitest";
import { ApiError } from "../api-error";

describe("ApiError", () => {
  it("captures status, body, and message", () => {
    const err = new ApiError(404, { code: "NOT_FOUND" }, "Not found");
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ code: "NOT_FOUND" });
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("ApiError");
  });

  it("is an Error subclass — instanceof works", () => {
    const err = new ApiError(500, null, "boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it("flags network errors via status 0", () => {
    expect(new ApiError(0, null, "Network").isNetworkError).toBe(true);
    expect(new ApiError(500, null, "Server").isNetworkError).toBe(false);
  });
});
