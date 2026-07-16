import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

import type { InvestmentV1 } from "../../src/api/types.js";

function investment(partial: Partial<InvestmentV1>): InvestmentV1 {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? "Investment",
    type: partial.type ?? "11_stock",
    currency: partial.currency ?? "EUR",
    ...partial,
  };
}

describe("aggregateAllocation", () => {
  it("aggregateAllocation groups market value by region name", async () => {
    const { aggregateAllocation } = await import("../../src/tools/allocation.js");
    const investments = [
      investment({ id: 1, currentMarketValue: 600, region: { id: 1, name: "United States" } }),
      investment({ id: 2, currentMarketValue: 300, region: { id: 1, name: "United States" } }),
      investment({ id: 3, currentMarketValue: 100, region: { id: 2, name: "Germany" } }),
    ];
    const buckets = aggregateAllocation(investments, "region");
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toEqual({ label: "United States", value: 900, percent: 90, positions: 2 });
  });

  it("aggregateAllocation sorts buckets by value descending", async () => {
    const { aggregateAllocation } = await import("../../src/tools/allocation.js");
    const investments = [
      investment({ id: 1, currentMarketValue: 100, industry: { id: 1, name: "Tech" } }),
      investment({ id: 2, currentMarketValue: 500, industry: { id: 2, name: "Health" } }),
    ];
    const buckets = aggregateAllocation(investments, "industry");
    expect(buckets.map((b) => b.label)).toEqual(["Health", "Tech"]);
  });

  it("aggregateAllocation labels investments without classification as Unclassified", async () => {
    const { aggregateAllocation } = await import("../../src/tools/allocation.js");
    const buckets = aggregateAllocation([investment({ id: 1, currentMarketValue: 50 })], "region");
    expect(buckets[0].label).toBe("Unclassified");
  });

  it("aggregateAllocation groups by asset type for the type dimension", async () => {
    const { aggregateAllocation } = await import("../../src/tools/allocation.js");
    const investments = [
      investment({ id: 1, type: "11_stock", currentMarketValue: 70 }),
      investment({ id: 2, type: "22_etf", currentMarketValue: 30 }),
    ];
    const buckets = aggregateAllocation(investments, "type");
    expect(buckets.map((b) => b.label)).toEqual(["11_stock", "22_etf"]);
    expect(buckets[1].percent).toBe(30);
  });

  it("aggregateAllocation returns zero percent when total value is zero", async () => {
    const { aggregateAllocation } = await import("../../src/tools/allocation.js");
    const buckets = aggregateAllocation([investment({ id: 1 })], "type");
    expect(buckets[0].percent).toBe(0);
  });
});
