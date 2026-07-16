import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { AccountList, DateValuePairList } from "../api/types.js";
import { formatCurrency, formatDate, formatPercent, formatTable } from "../util/format.js";

export function registerAccountTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "list_accounts",
    {
      description:
        "List all of the user's accounts: depots (where investments live), cash accounts, insurance, etc. Start here when you need to know which accounts exist before drilling in.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await client.get<AccountList>("/v1/accounts");
        const accounts = data.accounts ?? [];

        if (accounts.length === 0) {
          return { content: [{ type: "text" as const, text: "No accounts found." }] };
        }

        const headers = ["ID", "Name", "Type", "Balance", "Currency", "Linked To"];
        const rows = accounts.map((a) => {
          let linked = "—";
          if (a.contraAccountId) linked = `cash→${a.contraAccountId}`;
          else if (a.depotIds && a.depotIds.length > 0) linked = `depot→${a.depotIds.join(",")}`;
          return [
            String(a.id),
            a.name ?? "N/A",
            a.type ?? "N/A",
            a.balance !== undefined ? formatCurrency(a.balance, a.currency) : "N/A",
            a.currency ?? "N/A",
            linked,
          ];
        });

        const text = [
          `Found ${accounts.length} account(s):`,
          "",
          formatTable(headers, rows),
          "",
          "Use depot IDs (type '01_depot') for list_investments and list_bookings.",
          "Use cash account IDs (type '02_cash') for get_account_balances and list_transactions.",
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing accounts: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_account_balances",
    {
      description:
        "Get balance history for one or more cash accounts over a date range. Works only with cash accounts (type '02_cash'), not depots.",
      inputSchema: {
        id: z.array(z.number()).describe("Cash account ID(s)"),
        from: z.string().optional().describe("Start date (yyyy-MM-dd)"),
        to: z.string().optional().describe("End date (yyyy-MM-dd)"),
      },
    },
    async ({ id, from, to }) => {
      try {
        const data = await client.get<DateValuePairList>("/v1/accounts/balances", { id, from, to });
        const pairs = data.dateValuePairs ?? [];

        if (pairs.length === 0) {
          return { content: [{ type: "text" as const, text: "No balance data for this period." }] };
        }

        const first = pairs[0];
        const last = pairs[pairs.length - 1];
        const values = pairs.map((p) => p.value);

        const lines = [
          `Balance history (${pairs.length} data points):`,
          `Period: ${formatDate(first.date)} to ${formatDate(last.date)}`,
          `First: ${formatCurrency(first.value)}`,
          `Last:  ${formatCurrency(last.value)}`,
          `Min:   ${formatCurrency(Math.min(...values))}`,
          `Max:   ${formatCurrency(Math.max(...values))}`,
          "",
          pairs.length > 10 ? "Last 10 data points:" : "Data points:",
          ...pairs.slice(-10).map((p) => `  ${formatDate(p.date)}: ${formatCurrency(p.value)}`),
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting balances: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_portfolio_valuation",
    {
      description:
        "Get the current total value of one or more depots, and optionally its history when 'from' is given. Use this for 'what is my portfolio worth (today / over time)?'.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
        includeCash: z.boolean().default(true).describe("Include the cash position"),
        from: z.string().optional().describe("If set (yyyy-MM-dd), also return the valuation history since this date"),
        interval: z.enum(["day", "week", "month", "year"]).default("month").describe("History interval"),
      },
    },
    async ({ accountIds, includeCash, from, interval }) => {
      try {
        const current = await client.get<number>("/v1/accounts/valuation", {
          id: accountIds,
          includeCash,
        });

        const lines = [`Current portfolio value: ${formatCurrency(current)}`];

        if (from) {
          const history = await client.get<DateValuePairList>("/v1/accounts/historicValuations", {
            id: accountIds,
            intervalType: interval,
            startDate: from,
            includeCash,
            includeCurrentValue: true,
          });
          const pairs = history.dateValuePairs ?? [];

          if (pairs.length > 0) {
            const first = pairs[0];
            const change = first.value !== 0 ? ((current - first.value) / Math.abs(first.value)) * 100 : undefined;
            lines.push(
              `Since ${formatDate(first.date)}: ${formatCurrency(first.value)} → ${formatCurrency(current)}` +
                (change !== undefined ? ` (${formatPercent(change)})` : ""),
              "",
              pairs.length > 24 ? "Last 24 data points:" : "History:",
              ...pairs.slice(-24).map((p) => `  ${formatDate(p.date)}: ${formatCurrency(p.value)}`)
            );
          }
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting valuation: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
