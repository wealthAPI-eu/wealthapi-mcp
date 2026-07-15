import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { BatchRiskYieldMetrics, RiskYield } from "../api/types.js";
import { formatPercent, formatTable } from "../util/format.js";

export function riskClassLabel(riskClass?: number): string {
  if (riskClass === 0) return "low";
  if (riskClass === 1) return "medium";
  if (riskClass === 2) return "high";
  return "N/A";
}

export function registerRiskTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "get_risk_metrics",
    {
      description:
        "Get annualized risk (volatility) and return metrics — for the whole portfolio, or per investment with breakdown=true. Use this for 'how risky is my portfolio?'.",
      inputSchema: {
        depotIds: z.array(z.number()).optional().describe("Depot ID(s) to include"),
        investmentIds: z.array(z.number()).optional().describe("Investment ID(s), takes precedence over depotIds"),
        from: z.string().optional().describe("Start date (yyyy-MM-dd), defaults to 3 years ago, max 10 years back"),
        interval: z.enum(["day", "week", "month", "year"]).default("month"),
        breakdown: z.boolean().default(false).describe("true = metrics per investment, false = portfolio total"),
      },
    },
    async ({ depotIds, investmentIds, from, interval, breakdown }) => {
      try {
        const params = { depotId: depotIds, investmentId: investmentIds, from, interval };

        if (!breakdown) {
          const data = await client.get<RiskYield>("/v1/riskYieldMetrics", params);
          const text = [
            "Portfolio risk/yield metrics (annualized):",
            `Volatility (std deviation): ${formatPercent(data.annualizedStandardDeviation ?? 0).replace("+", "")} — risk class: ${riskClassLabel(data.annualizedRiskClass)}`,
            `Return: ${formatPercent(data.annualizedReturn ?? 0)} — return class: ${riskClassLabel(data.annualizedReturnClass)}`,
          ].join("\n");
          return { content: [{ type: "text" as const, text }] };
        }

        const data = await client.get<BatchRiskYieldMetrics>("/v1/riskYieldMetrics/investments", params);
        const metrics = data.riskYieldMetrics ?? [];

        if (metrics.length === 0) {
          return { content: [{ type: "text" as const, text: "No risk metrics available." }] };
        }

        const headers = ["Name", "ISIN", "Volatility", "Risk", "Return", "Return Class"];
        const rows = metrics.map((m) => [
          (m.investmentReference?.name ?? "N/A").slice(0, 35),
          m.investmentReference?.isin ?? "N/A",
          m.annualizedStandardDeviation !== undefined
            ? formatPercent(m.annualizedStandardDeviation).replace("+", "")
            : "N/A",
          riskClassLabel(m.annualizedRiskClass),
          m.annualizedReturn !== undefined ? formatPercent(m.annualizedReturn) : "N/A",
          riskClassLabel(m.annualizedReturnClass),
        ]);

        const text = [
          `Risk/yield metrics per investment (annualized, ${metrics.length} position(s)):`,
          "",
          formatTable(headers, rows),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting risk metrics: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
