import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type {
  DividendCalendarRecordList,
  DividendHistoryTree,
  DividendHistoryTreeNode,
  DividendYieldList,
} from "../api/types.js";
import { formatCurrency, formatDate, formatPercent, formatTable } from "../util/format.js";

export interface DividendYearSummary {
  year: number;
  gross: number;
  net: number;
  isPrediction: boolean;
}

export interface DividendMonthSummary {
  month: number;
  gross: number;
  net: number;
}

export function summarizeDividendYears(tree: DividendHistoryTree): DividendYearSummary[] {
  const nodes = Object.values(tree.nodesByYear ?? {});
  return nodes
    .map((n) => ({ year: n.year, gross: n.grossAmount, net: n.netAmount, isPrediction: n.isPrediction }))
    .sort((a, b) => a.year - b.year);
}

export function summarizeDividendMonths(node: DividendHistoryTreeNode): DividendMonthSummary[] {
  const children = node.children ?? {};
  return Object.entries(children)
    .map(([key, child]) => ({
      month: child.calendarMonth ?? Number(key) + 1,
      gross: child.grossAmount,
      net: child.netAmount,
    }))
    .sort((a, b) => a.month - b.month);
}

export function registerDividendTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "get_dividend_history",
    {
      description:
        "Get dividend income per year (gross and net), with a per-month breakdown for the current year. Use this for 'how much dividend income did I get in 2024?'.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
        cutoffDate: z.string().optional().describe("Only include dividends paid after this date (yyyy-MM-dd)"),
      },
    },
    async ({ accountIds, cutoffDate }) => {
      try {
        const tree = await client.get<DividendHistoryTree>("/v1/dividends/history", {
          accountId: accountIds,
          cutoffDate,
        });
        const years = summarizeDividendYears(tree);

        if (years.length === 0) {
          return { content: [{ type: "text" as const, text: "No dividend history found." }] };
        }

        const headers = ["Year", "Gross", "Net", "Predicted?"];
        const rows = years.map((y) => [
          String(y.year),
          formatCurrency(y.gross),
          formatCurrency(y.net),
          y.isPrediction ? "yes" : "",
        ]);

        const lines = ["Dividend income per year:", "", formatTable(headers, rows)];

        const currentYear = new Date().getFullYear();
        const currentNode = tree.nodesByYear?.[String(currentYear)];
        if (currentNode) {
          const months = summarizeDividendMonths(currentNode);
          if (months.length > 0) {
            lines.push("", `Per month in ${currentYear}:`);
            for (const m of months) {
              lines.push(`  ${currentYear}-${String(m.month).padStart(2, "0")}: gross ${formatCurrency(m.gross)}, net ${formatCurrency(m.net)}`);
            }
          }
        }

        lines.push("", "Amounts are in your reporting currency (EUR unless configured otherwise).");

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting dividend history: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_dividend_calendar",
    {
      description:
        "Get this year's dividend calendar for current holdings: expected and received payouts with dates, amounts and yields. Use this for 'when are my next dividend payments?'.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
      },
    },
    async ({ accountIds }) => {
      try {
        const data = await client.get<DividendCalendarRecordList>("/v1/dividends/calendar", {
          accountId: accountIds,
        });
        const records = [...(data.dividendCalendarRecords ?? [])].sort((a, b) =>
          (a.paymentDate ?? "").localeCompare(b.paymentDate ?? "")
        );

        if (records.length === 0) {
          return { content: [{ type: "text" as const, text: "No dividend payments expected this year." }] };
        }

        const headers = ["Payment Date", "Name", "Net", "Gross", "Lots", "Yield %", "Predicted?"];
        const rows = records.map((r) => [
          formatDate(r.paymentDate),
          (r.investmentReference?.name ?? "N/A").slice(0, 35),
          formatCurrency(r.netDividend, r.currency),
          formatCurrency(r.grossDividend, r.currency),
          String(r.numberOfLots),
          r.currentNetYieldPerYear !== undefined ? formatPercent(r.currentNetYieldPerYear) : "N/A",
          r.isPrediction ? "yes" : "",
        ]);

        const totalNet = records.reduce((sum, r) => sum + (r.netDividend ?? 0), 0);
        const totalGross = records.reduce((sum, r) => sum + (r.grossDividend ?? 0), 0);
        const currency = records[0]?.currency;

        const text = [
          `Dividend calendar for this year (${records.length} payment(s)):`,
          "",
          formatTable(headers, rows),
          "",
          `Total: net ${formatCurrency(totalNet, currency)}, gross ${formatCurrency(totalGross, currency)}.`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting dividend calendar: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_portfolio_yield",
    {
      description:
        "Get the portfolio's dividend yield per year (on current value and on invested capital) plus the dividend CAGR. Use this for 'what's my dividend yield?'.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
        calculationType: z
          .enum(["actual", "predicted"])
          .default("actual")
          .describe("'predicted' includes current-year predictions"),
        cagrYears: z.number().min(2).max(10).default(5).describe("Window for dividend CAGR"),
      },
    },
    async ({ accountIds, calculationType, cagrYears }) => {
      try {
        const data = await client.get<DividendYieldList>("/v1/dividends/portfolioYield", {
          accountId: accountIds,
          calculationType,
          cagrYears,
        });
        const yields = data.dividendYields ?? [];

        if (yields.length === 0) {
          return { content: [{ type: "text" as const, text: "No dividend yield data found." }] };
        }

        const headers = ["Year", "Gross Div", "Net Div", "Gross Yield", "Net Yield", "Net Yield on Cost"];
        const rows = yields.map((y) => [
          String(y.year),
          formatCurrency(y.totalGrossDividend, y.currency),
          formatCurrency(y.totalNetDividend, y.currency),
          formatPercent(y.grossYield),
          formatPercent(y.netYield),
          formatPercent(y.netYieldOnInvestedCapital),
        ]);

        const lines = ["Portfolio dividend yield per year:", "", formatTable(headers, rows)];

        const cagr = data.cagrResult;
        if (cagr && cagr.years > 0) {
          lines.push("", `Dividend CAGR ${cagr.initialYear}–${cagr.finalYear} (${cagr.years} years): ${formatPercent(cagr.cagr)}`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting portfolio yield: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
