import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { PortfolioPerformanceResultList, RealizedGainByYearList } from "../api/types.js";
import { formatCurrency, formatDate, formatPercent, formatTable } from "../util/format.js";

export function registerPerformanceTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "get_portfolio_performance",
    {
      description:
        "Get TWROR (time-weighted rate of return) timeseries for the portfolio over a date range. Use this to answer 'how did my portfolio perform this year / last 5 years?'.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
        startDate: z.string().describe("Start date (yyyy-MM-dd)"),
        endDate: z.string().optional().describe("End date (yyyy-MM-dd), defaults to today"),
        interval: z.enum(["day", "week", "month", "year"]).default("month"),
      },
    },
    async ({ accountIds, startDate, endDate, interval }) => {
      try {
        const body = {
          startDate,
          endDate: endDate ?? new Date().toISOString().slice(0, 10),
          accountIds,
          interval,
          cashFlowAndPerformanceStatisticsParamsList: [{}],
        };
        const data = await client.post<PortfolioPerformanceResultList>("/v2/performance", body);

        const dataPoints = data.portfolioPerformanceResults?.[0]?.twrorResults ?? [];
        if (dataPoints.length === 0) {
          return { content: [{ type: "text" as const, text: "No performance data returned." }] };
        }

        const first = dataPoints[0];
        const last = dataPoints[dataPoints.length - 1];
        const lines = [
          `Portfolio performance (${interval} interval):`,
          `Period: ${formatDate(first.date)} → ${formatDate(last.date)}`,
          `TWROR start: ${formatPercent((first.twror - 1) * 100)}`,
          `TWROR end:   ${formatPercent((last.twror - 1) * 100)}`,
          `Market value: ${formatCurrency(first.currentMarketValue ?? 0)} → ${formatCurrency(last.currentMarketValue ?? 0)}`,
          "",
          dataPoints.length > 20 ? "Last 20 data points:" : "Data points:",
        ];

        for (const dp of dataPoints.slice(-20)) {
          const parts = [`  ${formatDate(dp.date)}`, `TWROR: ${formatPercent((dp.twror - 1) * 100)}`];
          if (dp.currentMarketValue !== undefined) parts.push(`Value: ${formatCurrency(dp.currentMarketValue)}`);
          if (dp.cashFlow !== undefined && dp.cashFlow !== 0) parts.push(`Cash flow: ${formatCurrency(dp.cashFlow)}`);
          lines.push(parts.join(" | "));
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting performance: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_realized_gains",
    {
      description:
        "Get realized gains per year, split into trading, dividend, interest and other gains (gross and net, plus tax refunds). Use this for 'what did I realize this year?' and tax questions.",
      inputSchema: {
        accountIds: z.array(z.number()).describe("Depot ID(s) to include"),
      },
    },
    async ({ accountIds }) => {
      try {
        const data = await client.get<RealizedGainByYearList>("/v1/performance/realizedGains", {
          accountId: accountIds,
        });
        const gains = data.realizedGainsByYear ?? [];

        if (gains.length === 0) {
          return { content: [{ type: "text" as const, text: "No realized gains found." }] };
        }

        const headers = ["Year", "Total Net", "Trading Net", "Dividends Net", "Interest Net", "Other Net", "Tax Refund"];
        const rows = gains.map((g) => [
          String(g.year),
          formatCurrency(g.totalNetGain),
          formatCurrency(g.netTradingGain),
          formatCurrency(g.netDividendGain),
          formatCurrency(g.netInterestGain),
          formatCurrency(g.netOtherGain),
          formatCurrency(g.taxRefund),
        ]);

        const text = [
          "Realized gains per year (net of taxes and commissions):",
          "",
          formatTable(headers, rows),
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting realized gains: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
