import { describe, it, expect, afterEach, vi } from "vitest";

import { connectTools } from "../../src/library.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function callWith(body: unknown, tool: string, args: Record<string, unknown>): Promise<string> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
  );
  const connection = await connectTools({ baseUrl: "https://api.test/api", token: "t" });
  const result = await connection.call(tool, args);
  await connection.close();
  return result.text;
}

const YIELD = {
  year: 2025,
  totalGrossDividend: 100,
  totalNetDividend: 80,
  currency: "EUR",
  grossYield: 0.008,
  netYield: 0.006,
  netYieldOnInvestedCapital: 0.007,
};

describe("get_risk_metrics", () => {
  it("get_risk_metrics shows a volatility of 0.25 as 25.00%", async () => {
    const text = await callWith({ annualizedStandardDeviation: 0.25 }, "get_risk_metrics", {});
    expect(text).toContain("Volatility (std deviation): 25.00%");
  });

  it("get_risk_metrics shows a return of 0.38 as +38.00%", async () => {
    const text = await callWith({ annualizedReturn: 0.38 }, "get_risk_metrics", {});
    expect(text).toContain("Return: +38.00%");
  });

  it("get_risk_metrics shows an investment's fractions as percent", async () => {
    const metric = { annualizedStandardDeviation: 0.25, annualizedReturn: -0.05 };
    const text = await callWith({ riskYieldMetrics: [metric] }, "get_risk_metrics", { breakdown: true });
    expect(text).toContain("25.00%");
    expect(text).toContain("-5.00%");
  });
});

describe("get_portfolio_yield", () => {
  it("get_portfolio_yield shows a gross yield of 0.008 as +0.80%", async () => {
    const text = await callWith({ dividendYields: [YIELD] }, "get_portfolio_yield", { accountIds: [1] });
    expect(text).toContain("+0.80%");
  });

  it("get_portfolio_yield shows the net yields as percent", async () => {
    const text = await callWith({ dividendYields: [YIELD] }, "get_portfolio_yield", { accountIds: [1] });
    expect(text).toContain("+0.60%");
    expect(text).toContain("+0.70%");
  });

  it("get_portfolio_yield shows a dividend CAGR of 1.04 as +104.00%", async () => {
    const cagrResult = { initialYear: 2023, finalYear: 2025, years: 2, cagr: 1.04 };
    const text = await callWith({ dividendYields: [YIELD], cagrResult }, "get_portfolio_yield", { accountIds: [1] });
    expect(text).toContain("+104.00%");
  });
});
