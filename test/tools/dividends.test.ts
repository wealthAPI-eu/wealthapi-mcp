import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

import type { DividendHistoryTree, DividendHistoryTreeNode } from "../../src/api/types.js";

function node(partial: Partial<DividendHistoryTreeNode>): DividendHistoryTreeNode {
  return {
    year: partial.year ?? 2026,
    grossAmount: partial.grossAmount ?? 0,
    netAmount: partial.netAmount ?? 0,
    taxAndCommission: partial.taxAndCommission ?? 0,
    isPrediction: partial.isPrediction ?? false,
    ...partial,
  };
}

describe("summarizeDividendYears", () => {
  it("summarizeDividendYears returns one summary per year sorted ascending", async () => {
    const { summarizeDividendYears } = await import("../../src/tools/dividends.js");
    const tree: DividendHistoryTree = {
      nodesByYear: {
        "2026": node({ year: 2026, grossAmount: 100, netAmount: 80, isPrediction: true }),
        "2024": node({ year: 2024, grossAmount: 300, netAmount: 250 }),
        "2025": node({ year: 2025, grossAmount: 200, netAmount: 160 }),
      },
    };
    const years = summarizeDividendYears(tree);
    expect(years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(years[0]).toEqual({ year: 2024, gross: 300, net: 250, isPrediction: false });
  });

  it("summarizeDividendYears returns empty array for empty tree", async () => {
    const { summarizeDividendYears } = await import("../../src/tools/dividends.js");
    expect(summarizeDividendYears({})).toEqual([]);
  });
});

describe("summarizeDividendMonths", () => {
  it("summarizeDividendMonths prefers calendarMonth over zero-based child key", async () => {
    const { summarizeDividendMonths } = await import("../../src/tools/dividends.js");
    const yearNode = node({
      year: 2026,
      children: {
        "0": node({ year: 2026, calendarMonth: 1, grossAmount: 10, netAmount: 8 }),
        "5": node({ year: 2026, calendarMonth: 6, grossAmount: 20, netAmount: 16 }),
      },
    });
    const months = summarizeDividendMonths(yearNode);
    expect(months.map((m) => m.month)).toEqual([1, 6]);
  });

  it("summarizeDividendMonths converts zero-based key when calendarMonth is missing", async () => {
    const { summarizeDividendMonths } = await import("../../src/tools/dividends.js");
    const yearNode = node({
      year: 2026,
      children: { "11": node({ year: 2026, grossAmount: 5, netAmount: 4 }) },
    });
    expect(summarizeDividendMonths(yearNode)[0].month).toBe(12);
  });

  it("summarizeDividendMonths sorts months chronologically", async () => {
    const { summarizeDividendMonths } = await import("../../src/tools/dividends.js");
    const yearNode = node({
      year: 2026,
      children: {
        "8": node({ year: 2026, calendarMonth: 9, grossAmount: 1, netAmount: 1 }),
        "2": node({ year: 2026, calendarMonth: 3, grossAmount: 1, netAmount: 1 }),
      },
    });
    expect(summarizeDividendMonths(yearNode).map((m) => m.month)).toEqual([3, 9]);
  });
});
