import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

const BASE = "https://www.wealthapi.eu/api";

describe("buildUrl", () => {
  it("builds a simple URL without params", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    expect(buildUrl(BASE, "/v1/accounts")).toBe("https://www.wealthapi.eu/api/v1/accounts");
  });

  it("appends scalar params", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    const url = buildUrl(BASE, "/v1/transactions", { minDate: "2024-01-01", perPage: 100 });
    expect(url).toContain("minDate=2024-01-01");
    expect(url).toContain("perPage=100");
  });

  it("appends array params as repeated keys", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    const url = buildUrl(BASE, "/v1/investments", { accountId: [1, 2, 3] });
    expect(url).toContain("accountId=1");
    expect(url).toContain("accountId=2");
    expect(url).toContain("accountId=3");
  });

  it("skips undefined params", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    const url = buildUrl(BASE, "/v1/test", { a: "yes", b: undefined });
    expect(url).toContain("a=yes");
    expect(url).not.toContain("b=");
  });

  it("handles boolean params", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    const url = buildUrl(BASE, "/v1/test", { includeHistoric: true });
    expect(url).toContain("includeHistoric=true");
  });

  it("handles empty params object", async () => {
    const { buildUrl } = await import("../../src/api/client.js");
    expect(buildUrl(BASE, "/v1/test", {})).toBe("https://www.wealthapi.eu/api/v1/test");
  });
});
