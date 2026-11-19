import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

import type { InvestmentV2 } from "../../src/api/types.js";

function investment(partial: Partial<InvestmentV2>): InvestmentV2 {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? "Investment",
    type: partial.type ?? "21_fund",
    currency: partial.currency ?? "EUR",
    ...partial,
  };
}

describe("investmentRow", () => {
  it("investmentRow shows the depot the investment is in", async () => {
    const { investmentRow } = await import("../../src/tools/investments.js");
    expect(investmentRow(investment({ depotId: 42 }))[3]).toBe("42");
  });

  it("investmentRow shows N/A for an investment without a depot", async () => {
    const { investmentRow } = await import("../../src/tools/investments.js");
    expect(investmentRow(investment({}))[3]).toBe("N/A");
  });

  it("investmentRow cuts a long name to 40 characters", async () => {
    const { investmentRow } = await import("../../src/tools/investments.js");
    expect(investmentRow(investment({ name: "x".repeat(60) }))[0]).toHaveLength(40);
  });
});
