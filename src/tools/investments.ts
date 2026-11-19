import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { InvestmentV2, PageableInvestmentV2List, PageableInvestmentList } from "../api/types.js";
import { formatCurrency, formatPercent, formatTable } from "../util/format.js";

const INVESTMENT_HEADERS = ["Name", "ISIN", "Type", "Depot ID", "Lots", "Market Value", "P&L %", "Currency"];

export function investmentRow(investment: InvestmentV2): string[] {
  const valuation = investment.quoteAndValuation;
  return [
    (investment.name ?? "N/A").slice(0, 40),
    investment.isin ?? "N/A",
    investment.type ?? "N/A",
    investment.depotId !== undefined ? String(investment.depotId) : "N/A",
    investment.numberOfLots !== undefined ? String(investment.numberOfLots) : "N/A",
    valuation?.currentMarketValue !== undefined
      ? formatCurrency(valuation.currentMarketValue, investment.currency)
      : "N/A",
    valuation?.returnOnInvestmentInPercent !== undefined
      ? formatPercent(valuation.returnOnInvestmentInPercent * 100)
      : "N/A",
    investment.currency ?? "N/A",
  ];
}

export function registerInvestmentTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "list_investments",
    {
      description:
        "List the user's investment holdings (stocks, funds, bonds, ETFs). Returns name, ISIN, type, depot ID, lots, market value and gain/loss. Use this for 'what do I own?' and 'show me my biggest positions'.",
      inputSchema: {
        depotId: z.array(z.number()).optional().describe("Filter by depot ID(s)"),
        includeHistoric: z.boolean().default(false).describe("Include sold (historic) positions"),
      },
    },
    async ({ depotId, includeHistoric }) => {
      try {
        const data = await client.get<PageableInvestmentV2List>("/v2/investments", {
          depotId,
          includeHistoric: String(includeHistoric),
          include: "quoteAndValuation",
          perPage: 500,
        });
        const investments = data.investments ?? [];

        if (investments.length === 0) {
          return { content: [{ type: "text" as const, text: "No investments found." }] };
        }

        const sorted = [...investments].sort((a, b) => {
          const va = a.quoteAndValuation?.currentMarketValue ?? 0;
          const vb = b.quoteAndValuation?.currentMarketValue ?? 0;
          return vb - va;
        });

        const lines = [`Found ${investments.length} investment(s), sorted by market value:`, "", formatTable(INVESTMENT_HEADERS, sorted.map(investmentRow))];

        if (data.paging && data.paging.pageCount > 1) {
          lines.push("", `Showing page 1 of ${data.paging.pageCount} (${data.paging.totalCount} total).`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing investments: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_gainers_and_losers",
    {
      description:
        "Get the top gainers or losers — either by today's change or by total return since purchase. Use this for 'best/worst performers'.",
      inputSchema: {
        mode: z
          .enum(["gainers", "losers", "gainersTotal", "losersTotal"])
          .describe("'gainers'/'losers' for today; 'gainersTotal'/'losersTotal' for total return"),
        max: z.number().default(5).describe("How many to return"),
        accountId: z.array(z.number()).optional().describe("Filter by depot ID(s)"),
      },
    },
    async ({ mode, max, accountId }) => {
      try {
        const data = await client.get<PageableInvestmentList>("/v1/investments/gainersAndLosers", {
          mode,
          max,
          accountId,
        });
        const investments = data.investments ?? [];

        if (investments.length === 0) {
          return { content: [{ type: "text" as const, text: `No ${mode} found.` }] };
        }

        const isTotal = mode.includes("Total");
        const headers = [
          "Name",
          "ISIN",
          "Type",
          isTotal ? "Total Return %" : "Today's Change %",
          "Market Value",
        ];
        const rows = investments.map((inv) => [
          (inv.name ?? "N/A").slice(0, 40),
          inv.isin ?? "N/A",
          inv.type ?? "N/A",
          isTotal
            ? inv.returnOnInvestmentInPercent !== undefined
              ? formatPercent(inv.returnOnInvestmentInPercent * 100)
              : "N/A"
            : inv.quote?.changePercentAbs !== undefined
              ? formatPercent(inv.quote.changePercentAbs * 100)
              : "N/A",
          inv.currentMarketValue !== undefined ? formatCurrency(inv.currentMarketValue, inv.currency) : "N/A",
        ]);

        const text = [`Top ${investments.length} ${mode}:`, "", formatTable(headers, rows)].join("\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting gainers/losers: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
