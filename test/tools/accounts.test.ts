import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BEARER_TOKEN = "test-token";
});

import type { Account } from "../../src/api/types.js";

function account(partial: Partial<Account>): Account {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? "Depot",
    type: partial.type ?? "01_depot",
    ...partial,
  };
}

describe("accountRow", () => {
  it("accountRow puts the bank name after the account name", async () => {
    const { accountRow } = await import("../../src/tools/accounts.js");
    const row = accountRow(account({ id: 7, name: "Direkt-Depot", bankName: "ING" }));
    expect(row.slice(0, 3)).toEqual(["7", "Direkt-Depot", "ING"]);
  });

  it("accountRow shows N/A for an account without a bank name", async () => {
    const { accountRow } = await import("../../src/tools/accounts.js");
    expect(accountRow(account({}))[2]).toBe("N/A");
  });

  it("accountRow links a depot to its cash account", async () => {
    const { accountRow } = await import("../../src/tools/accounts.js");
    expect(accountRow(account({ contraAccountId: 12 })).at(-1)).toBe("cash→12");
  });

  it("accountRow links a cash account to its depots", async () => {
    const { accountRow } = await import("../../src/tools/accounts.js");
    expect(accountRow(account({ type: "02_cash", depotIds: [3, 4] })).at(-1)).toBe("depot→3,4");
  });
});
