import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { InvestmentV1, PageableInvestmentList } from "../api/types.js";
import { formatCurrency, formatPercent, formatTable } from "../util/format.js";

export type AllocationDimension = "region" | "industry" | "type";

export interface AllocationBucket {
  label: string;
  value: number;
  percent: number;
  positions: number;
}

export function aggregateAllocation(
  investments: InvestmentV1[],
  dimension: AllocationDimension
): AllocationBucket[] {
  const buckets = new Map<string, { value: number; positions: number }>();
  let total = 0;

  for (const inv of investments) {
    const value = inv.currentMarketValue ?? 0;
    const label = allocationLabel(inv, dimension);
    const bucket = buckets.get(label) ?? { value: 0, positions: 0 };
    bucket.value += value;
    bucket.positions += 1;
    buckets.set(label, bucket);
    total += value;
  }

  return [...buckets.entries()]
    .map(([label, b]) => ({
      label,
      value: b.value,
      percent: total > 0 ? (b.value / total) * 100 : 0,
      positions: b.positions,
    }))
    .sort((a, b) => b.value - a.value);
}

function allocationLabel(inv: InvestmentV1, dimension: AllocationDimension): string {
  if (dimension === "region") return inv.region?.name ?? "Unclassified";
  if (dimension === "industry") return inv.industry?.name ?? "Unclassified";
  return inv.type ?? "Unclassified";
}

export function registerAllocationTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "get_portfolio_allocation",
    {
      description:
        "Break down the portfolio's market value by region, industry sector, or asset type. Use this for 'how diversified am I?' and 'what's my US exposure?'.",
      inputSchema: {
        dimension: z.enum(["region", "industry", "type"]).describe("What to group by"),
        accountIds: z.array(z.number()).optional().describe("Depot ID(s) to include, defaults to all"),
      },
    },
    async ({ dimension, accountIds }) => {
      try {
        const data = await client.get<PageableInvestmentList>("/v1/investments", {
          accountId: accountIds,
          perPage: 500,
        });
        const investments = data.investments ?? [];

        if (investments.length === 0) {
          return { content: [{ type: "text" as const, text: "No investments found." }] };
        }

        const buckets = aggregateAllocation(investments, dimension);
        const total = buckets.reduce((sum, b) => sum + b.value, 0);

        const headers = [dimensionHeader(dimension), "Market Value", "Share", "Positions"];
        const rows = buckets.map((b) => [
          b.label,
          formatCurrency(b.value),
          formatPercent(b.percent).replace("+", ""),
          String(b.positions),
        ]);

        const text = [
          `Portfolio allocation by ${dimension} (${investments.length} position(s), total ${formatCurrency(total)}):`,
          "",
          formatTable(headers, rows),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting allocation: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function dimensionHeader(dimension: AllocationDimension): string {
  if (dimension === "region") return "Region";
  if (dimension === "industry") return "Industry";
  return "Asset Type";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
