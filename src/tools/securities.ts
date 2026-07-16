import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { FundamentalStatistic, QuoteList, SecurityInfo, StatisticList, SymbolListV2 } from "../api/types.js";
import { formatCurrency, formatDate, formatPercent, formatTable } from "../util/format.js";

export function latestStatistic(statistics: FundamentalStatistic[]): FundamentalStatistic | undefined {
  return [...statistics].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).pop();
}

export function registerSecurityTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "search_symbols",
    {
      description:
        "Search securities by name, ISIN or WKN. Returns the security ID and quote provider needed by get_quotes. Use this to resolve 'Apple' or an ISIN to a tradable security.",
      inputSchema: {
        search: z.string().min(3).optional().describe("Name search (min 3 characters)"),
        isinOrWkn: z.string().optional().describe("Exact ISIN or WKN (alternative to search)"),
        types: z.array(z.string()).optional().describe("Filter by asset type, e.g. 11_stock, 22_etf, 21_fund"),
        maxPerAssetType: z.number().default(10).describe("Max hits per asset type"),
      },
    },
    async ({ search, isinOrWkn, types, maxPerAssetType }) => {
      try {
        if (!search && !isinOrWkn) {
          return {
            content: [{ type: "text" as const, text: "Provide either 'search' or 'isinOrWkn'." }],
            isError: true,
          };
        }

        const data = await client.get<SymbolListV2>("/v2/symbols", {
          search,
          isinOrWkn,
          type: types,
          perAssetType: maxPerAssetType,
        });
        const symbols = data.symbols ?? [];

        if (symbols.length === 0) {
          return { content: [{ type: "text" as const, text: "No securities found." }] };
        }

        const headers = ["Name", "ISIN", "Type", "Region", "Sector", "Security ID", "Quote Provider"];
        const rows = symbols.map((s) => [
          (s.name ?? "N/A").slice(0, 35),
          s.isin ?? "N/A",
          s.type ?? "N/A",
          s.regionName ?? "N/A",
          s.sectorName ?? "N/A",
          s.id,
          s.quoteProvider,
        ]);

        const text = [
          `Found ${symbols.length} securit(y/ies):`,
          "",
          formatTable(headers, rows),
          "",
          "Pass Security ID + Quote Provider to get_quotes for current prices.",
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error searching symbols: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_quotes",
    {
      description:
        "Get current quotes (last price, daily change) for securities by security ID. Get the IDs from search_symbols first.",
      inputSchema: {
        securityIds: z.array(z.string()).describe("Security ID(s) from search_symbols"),
        quoteProvider: z.string().describe("Quote provider from search_symbols"),
        preferredCurrency: z.string().default("EUR").describe("Preferred quote currency"),
      },
    },
    async ({ securityIds, quoteProvider, preferredCurrency }) => {
      try {
        const data = await client.get<QuoteList>("/v2/quotes", {
          securityId: securityIds,
          quoteProvider,
          preferredCurrency,
        });
        const quotes = data.quotes ?? [];

        if (quotes.length === 0) {
          return { content: [{ type: "text" as const, text: "No quotes found." }] };
        }

        const headers = ["Ticker", "Last", "Change", "Change %", "Exchange", "Time"];
        const rows = quotes.map((q) => [
          q.tickerSymbol ?? "N/A",
          formatCurrency(q.last, q.currency),
          formatCurrency(q.changeAbs, q.currency),
          formatPercent(q.changePercent),
          q.stockExchangeName ?? "N/A",
          formatDate(q.lastDateTime),
        ]);

        return {
          content: [{ type: "text" as const, text: formatTable(headers, rows) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting quotes: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_security_fundamentals",
    {
      description:
        "Get master data and valuation fundamentals (P/E, P/B, P/S, F-Score) for a security by ISIN. Use this for 'tell me about this holding' or 'is this stock expensive?'.",
      inputSchema: {
        isin: z.string().describe("The security's ISIN"),
      },
    },
    async ({ isin }) => {
      try {
        const security = await client.get<SecurityInfo>(`/v1/fundamentals/${isin}`);

        const lines = [
          `${security.name ?? isin} (${security.isin ?? isin})`,
          `Country: ${security.country?.name ?? "N/A"} | Sector: ${security.sector?.name ?? "N/A"} | Currency: ${security.currency ?? "N/A"}`,
        ];

        if (security.stockIndexes && security.stockIndexes.length > 0) {
          lines.push(`Indexes: ${security.stockIndexes.map((i) => i.name).join(", ")}`);
        }

        const stats = await fetchStatistics(client, isin);
        if (stats) {
          lines.push(
            "",
            `Valuation (as of ${formatDate(stats.date ?? "")}):`,
            `  P/E: ${formatRatio(stats.priceToEarnings)} | P/B: ${formatRatio(stats.priceToBook)} | P/S: ${formatRatio(stats.priceToSales)}`,
            `  P/CF: ${formatRatio(stats.priceToCashflow)} | P/FCF: ${formatRatio(stats.priceToFreeCashflow)} | F-Score: ${formatRatio(stats.fScore)}`
          );
        } else {
          lines.push("", "No valuation statistics available (may require a PRO subscription).");
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting fundamentals: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

async function fetchStatistics(client: ApiClient, isin: string): Promise<FundamentalStatistic | undefined> {
  try {
    const data = await client.get<StatisticList>(`/v1/fundamentals/${isin}/statistics`);
    return latestStatistic(data.statistics ?? []);
  } catch {
    return undefined;
  }
}

function formatRatio(value?: number): string {
  return value !== undefined ? value.toFixed(2) : "N/A";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
