import { describe, it, expect, afterEach, vi } from "vitest";

import { connectTools } from "../src/library.js";

const OPTIONS = { baseUrl: "https://api.test/api", token: "member-token" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("connectTools", () => {
  it("connectTools lists the 21 tools with a JSON Schema each", async () => {
    const connection = await connectTools(OPTIONS);
    expect(connection.tools).toHaveLength(21);
    expect(connection.tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
    await connection.close();
  });

  it("connectTools calls the given base URL with the given token", async () => {
    const fetchMock = stubFetch({ accounts: [] });
    const connection = await connectTools(OPTIONS);
    await connection.call("list_accounts", {});
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/accounts");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer member-token");
    await connection.close();
  });

  it("connectTools returns the tool's text", async () => {
    stubFetch({ accounts: [] });
    const connection = await connectTools(OPTIONS);
    const result = await connection.call("list_accounts", {});
    expect(result).toEqual({ text: "No accounts found.", isError: false });
    await connection.close();
  });

  it("connectTools keeps two members' tokens apart", async () => {
    const fetchMock = stubFetch({ accounts: [] });
    const first = await connectTools({ ...OPTIONS, token: "first" });
    const second = await connectTools({ ...OPTIONS, token: "second" });
    await second.call("list_accounts", {});
    await first.call("list_accounts", {});
    const tokens = fetchMock.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>).Authorization
    );
    expect(tokens).toEqual(["Bearer second", "Bearer first"]);
    await Promise.all([first.close(), second.close()]);
  });
});
