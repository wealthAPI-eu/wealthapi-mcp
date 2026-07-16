import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

describe("latestStatistic", () => {
  it("latestStatistic returns the entry with the most recent date", async () => {
    const { latestStatistic } = await import("../../src/tools/securities.js");
    const latest = latestStatistic([
      { date: "2026-01-01T00:00:00+0000", priceToEarnings: 20 },
      { date: "2026-06-01T00:00:00+0000", priceToEarnings: 25 },
      { date: "2025-06-01T00:00:00+0000", priceToEarnings: 18 },
    ]);
    expect(latest?.priceToEarnings).toBe(25);
  });

  it("latestStatistic returns undefined for an empty list", async () => {
    const { latestStatistic } = await import("../../src/tools/securities.js");
    expect(latestStatistic([])).toBeUndefined();
  });
});

describe("riskClassLabel", () => {
  it("riskClassLabel maps classes 0 to 2 onto low, medium, high", async () => {
    const { riskClassLabel } = await import("../../src/tools/risk.js");
    expect(riskClassLabel(0)).toBe("low");
    expect(riskClassLabel(1)).toBe("medium");
    expect(riskClassLabel(2)).toBe("high");
  });

  it("riskClassLabel returns N/A when the class is missing", async () => {
    const { riskClassLabel } = await import("../../src/tools/risk.js");
    expect(riskClassLabel(undefined)).toBe("N/A");
  });
});
