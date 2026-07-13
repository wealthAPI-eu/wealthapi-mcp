import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetchWith(status: number, body: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status }))
  );
}

describe("ApiClient.get", () => {
  it("get reports status, method and path on API errors", async () => {
    stubFetchWith(400, '{"error":"bad request"}');
    const { ApiClient } = await import("../../src/api/client.js");
    const error = await new ApiClient().get("/v1/accounts").catch((e: unknown) => e);
    expect(String(error)).toContain("API error 400 on GET /v1/accounts");
  });

  it("get omits the response body from API error messages", async () => {
    stubFetchWith(400, '{"iban":"DE89370400440532013000"}');
    const { ApiClient } = await import("../../src/api/client.js");
    const error = await new ApiClient().get("/v1/accounts").catch((e: unknown) => e);
    expect(String(error)).not.toContain("DE89370400440532013000");
  });
});
