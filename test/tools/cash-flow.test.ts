import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

import type {
  ExtendedDateValuePairList,
  IncomeAndSpendingHistory,
  Transaction,
} from "../../src/api/types.js";

function list(pairs: { date: string; value: number }[]): ExtendedDateValuePairList {
  return {
    mean: 0,
    curatedMean: 0,
    extendedDateValuePairs: pairs.map((p) => ({ date: p.date, value: p.value })),
  };
}

describe("aggregateCashFlow", () => {
  it("aggregateCashFlow sums regular and non-regular income per month", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const history: IncomeAndSpendingHistory = {
      averageRegularIncome: list([{ date: "2026-01-15", value: 3000 }]),
      averageNonRegularIncome: list([{ date: "2026-01-20", value: 500 }]),
    };
    const agg = aggregateCashFlow(history);
    expect(agg.months).toHaveLength(1);
    expect(agg.months[0].month).toBe("2026-01");
    expect(agg.months[0].income).toBe(3500);
  });

  it("aggregateCashFlow converts negative expenses to positive spending", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const history: IncomeAndSpendingHistory = {
      averageRegularExpenses: list([{ date: "2026-01-10", value: -1200 }]),
      averageNonRegularExpenses: list([{ date: "2026-01-25", value: -300 }]),
    };
    const agg = aggregateCashFlow(history);
    expect(agg.months[0].spending).toBe(1500);
  });

  it("aggregateCashFlow computes net as income minus spending per month", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const history: IncomeAndSpendingHistory = {
      averageRegularIncome: list([{ date: "2026-02-01", value: 4000 }]),
      averageRegularExpenses: list([{ date: "2026-02-15", value: -2500 }]),
    };
    const agg = aggregateCashFlow(history);
    expect(agg.months[0].net).toBe(1500);
  });

  it("aggregateCashFlow sorts months chronologically", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const history: IncomeAndSpendingHistory = {
      averageRegularIncome: list([
        { date: "2026-03-01", value: 1000 },
        { date: "2026-01-01", value: 1000 },
        { date: "2026-02-01", value: 1000 },
      ]),
    };
    const agg = aggregateCashFlow(history);
    expect(agg.months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("aggregateCashFlow computes average monthly income over distinct months", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const history: IncomeAndSpendingHistory = {
      averageRegularIncome: list([
        { date: "2026-01-01", value: 3000 },
        { date: "2026-02-01", value: 3000 },
      ]),
      averageRegularExpenses: list([
        { date: "2026-01-15", value: -2000 },
        { date: "2026-02-15", value: -1000 },
      ]),
    };
    const agg = aggregateCashFlow(history);
    expect(agg.totalIncome).toBe(6000);
    expect(agg.totalSpending).toBe(3000);
    expect(agg.avgMonthlyIncome).toBe(3000);
    expect(agg.avgMonthlySpending).toBe(1500);
    expect(agg.net).toBe(3000);
  });

  it("aggregateCashFlow returns empty result when history has no data", async () => {
    const { aggregateCashFlow } = await import("../../src/tools/cash-flow.js");
    const agg = aggregateCashFlow({});
    expect(agg.months).toEqual([]);
    expect(agg.totalIncome).toBe(0);
    expect(agg.totalSpending).toBe(0);
  });
});

describe("computeSavingsRate", () => {
  it("computeSavingsRate returns percentage of income kept", async () => {
    const { computeSavingsRate } = await import("../../src/tools/cash-flow.js");
    expect(computeSavingsRate(4000, 3000)).toBe(25);
  });

  it("computeSavingsRate returns null when income is zero", async () => {
    const { computeSavingsRate } = await import("../../src/tools/cash-flow.js");
    expect(computeSavingsRate(0, 500)).toBeNull();
  });

  it("computeSavingsRate returns negative rate when spending exceeds income", async () => {
    const { computeSavingsRate } = await import("../../src/tools/cash-flow.js");
    expect(computeSavingsRate(1000, 1500)).toBe(-50);
  });
});

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 1,
    type: partial.type ?? "withdrawal",
    isRegular: true,
    ...partial,
  };
}

describe("groupRecurring", () => {
  it("groupRecurring groups transactions by counterpart and direction", async () => {
    const { groupRecurring } = await import("../../src/tools/cash-flow.js");
    const transactions = [
      tx({ id: 1, counterpartName: "Netflix", amount: -15, paymentInterval: 1, valueDate: "2026-01-05" }),
      tx({ id: 2, counterpartName: "Netflix", amount: -15, paymentInterval: 1, valueDate: "2026-02-05" }),
      tx({ id: 3, counterpartName: "Employer", amount: 3000, paymentInterval: 1, valueDate: "2026-02-25" }),
    ];
    const groups = groupRecurring(transactions, "all");
    expect(groups).toHaveLength(2);
    const netflix = groups.find((g) => g.label === "Netflix")!;
    expect(netflix.count).toBe(2);
    expect(netflix.direction).toBe("out");
    expect(netflix.lastSeen).toBe("2026-02-05");
  });

  it("groupRecurring filters by outflow direction", async () => {
    const { groupRecurring } = await import("../../src/tools/cash-flow.js");
    const transactions = [
      tx({ id: 1, counterpartName: "Netflix", amount: -15, valueDate: "2026-01-05" }),
      tx({ id: 2, counterpartName: "Employer", amount: 3000, valueDate: "2026-01-25" }),
    ];
    const groups = groupRecurring(transactions, "outflow");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Netflix");
  });

  it("groupRecurring filters by inflow direction", async () => {
    const { groupRecurring } = await import("../../src/tools/cash-flow.js");
    const transactions = [
      tx({ id: 1, counterpartName: "Netflix", amount: -15, valueDate: "2026-01-05" }),
      tx({ id: 2, counterpartName: "Employer", amount: 3000, valueDate: "2026-01-25" }),
    ];
    const groups = groupRecurring(transactions, "inflow");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Employer");
  });

  it("groupRecurring sorts groups by absolute average amount descending", async () => {
    const { groupRecurring } = await import("../../src/tools/cash-flow.js");
    const transactions = [
      tx({ id: 1, counterpartName: "Netflix", amount: -15, averageRegularAmount: -15 }),
      tx({ id: 2, counterpartName: "Rent", amount: -1200, averageRegularAmount: -1200 }),
      tx({ id: 3, counterpartName: "Gym", amount: -50, averageRegularAmount: -50 }),
    ];
    const groups = groupRecurring(transactions, "all");
    expect(groups.map((g) => g.label)).toEqual(["Rent", "Gym", "Netflix"]);
  });

  it("groupRecurring falls back to purpose when counterpart is missing", async () => {
    const { groupRecurring } = await import("../../src/tools/cash-flow.js");
    const transactions = [
      tx({ id: 1, counterpartName: "", purpose: "Standing order ref 42", amount: -100 }),
    ];
    const groups = groupRecurring(transactions, "all");
    expect(groups[0].label).toBe("Standing order ref 42");
  });
});

describe("monthlyEquivalent", () => {
  it("monthlyEquivalent normalizes quarterly outflow to per-month value", async () => {
    const { monthlyEquivalent } = await import("../../src/tools/cash-flow.js");
    const result = monthlyEquivalent([
      { label: "Insurance", direction: "out", interval: 3, averageAmount: -300, currency: "EUR", count: 4, lastSeen: "2026-01-01" },
    ]);
    expect(result.outflow).toBe(100);
    expect(result.inflow).toBe(0);
  });

  it("monthlyEquivalent treats missing interval as monthly", async () => {
    const { monthlyEquivalent } = await import("../../src/tools/cash-flow.js");
    const result = monthlyEquivalent([
      { label: "Netflix", direction: "out", interval: null, averageAmount: -15, currency: "EUR", count: 3, lastSeen: "2026-01-01" },
    ]);
    expect(result.outflow).toBe(15);
  });

  it("monthlyEquivalent separates inflow and outflow", async () => {
    const { monthlyEquivalent } = await import("../../src/tools/cash-flow.js");
    const result = monthlyEquivalent([
      { label: "Salary", direction: "in", interval: 1, averageAmount: 3000, currency: "EUR", count: 6, lastSeen: "2026-01-01" },
      { label: "Rent", direction: "out", interval: 1, averageAmount: -1200, currency: "EUR", count: 6, lastSeen: "2026-01-01" },
    ]);
    expect(result.inflow).toBe(3000);
    expect(result.outflow).toBe(1200);
  });
});
