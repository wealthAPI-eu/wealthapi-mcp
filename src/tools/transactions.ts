import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { PageableBookingList, PageableTransactionList } from "../api/types.js";
import { formatCurrency, formatDate, formatTable } from "../util/format.js";

export function registerTransactionTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "list_transactions",
    {
      description:
        "List cash transactions (deposits, withdrawals, fees, interest, transfers). Results are sorted by amount (largest absolute value first), so the top rows answer 'what did I spend most money on?'.",
      inputSchema: {
        accountId: z.array(z.number()).optional().describe("Cash account ID(s) to filter by"),
        type: z.array(z.string()).optional().describe("Types: withdrawal, deposit, interest, tax_refund, other_gains"),
        minDate: z.string().optional().describe("Start date (yyyy-MM-dd)"),
        maxDate: z.string().optional().describe("End date (yyyy-MM-dd)"),
        perPage: z.number().default(100).describe("Max results to return (up to 500)"),
      },
    },
    async ({ accountId, type, minDate, maxDate, perPage }) => {
      try {
        const data = await client.get<PageableTransactionList>("/v1/transactions", {
          accountId,
          type,
          minDate,
          maxDate,
          perPage,
        });
        const transactions = data.transactions ?? [];

        if (transactions.length === 0) {
          return { content: [{ type: "text" as const, text: "No transactions found." }] };
        }

        const sorted = [...transactions].sort(
          (a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)
        );

        const headers = ["Date", "Type", "Amount", "Currency", "Counterpart", "Purpose"];
        const rows = sorted.map((t) => [
          formatDate(t.valueDate ?? ""),
          t.type ?? "N/A",
          t.amount !== undefined ? formatCurrency(t.amount, t.currency) : "N/A",
          t.currency ?? "N/A",
          (t.counterpartName ?? "—").slice(0, 30),
          (t.purpose ?? "—").slice(0, 40),
        ]);

        const lines = [
          `Found ${transactions.length} transaction(s), sorted by absolute amount:`,
          "",
          formatTable(headers, rows),
        ];

        if (data.paging && data.paging.pageCount > 1) {
          lines.push("", `Showing ${transactions.length} of ${data.paging.totalCount} total.`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing transactions: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_bookings",
    {
      description:
        "List investment bookings: buys, sells, dividends, splits. Use this to see the trade history for a specific security or depot.",
      inputSchema: {
        accountId: z.array(z.number()).optional().describe("Depot ID(s) to filter by"),
        isin: z.string().optional().describe("Filter by ISIN"),
        type: z
          .array(z.enum(["buy", "sell", "dividend", "split", "book_in", "book_out"]))
          .optional()
          .describe("Filter by booking type(s)"),
        minDate: z.string().optional().describe("Start date (yyyy-MM-dd)"),
        maxDate: z.string().optional().describe("End date (yyyy-MM-dd)"),
        perPage: z.number().default(100).describe("Max results to return (up to 500)"),
      },
    },
    async ({ accountId, isin, type, minDate, maxDate, perPage }) => {
      try {
        const data = await client.get<PageableBookingList>("/v1/bookings", {
          accountId,
          isin,
          type,
          minDate,
          maxDate,
          perPage,
          order: ["valueDate desc"],
        });
        const bookings = data.bookings ?? [];

        if (bookings.length === 0) {
          return { content: [{ type: "text" as const, text: "No bookings found." }] };
        }

        const headers = ["Date", "Type", "Investment", "ISIN", "Lots", "Amount"];
        const rows = bookings.map((b) => [
          formatDate(b.valueDate ?? ""),
          b.type ?? "N/A",
          (b.investment?.name ?? "—").slice(0, 35),
          b.investment?.isin ?? "—",
          b.numberOfLots !== undefined ? String(b.numberOfLots) : "—",
          b.amount !== undefined ? formatCurrency(b.amount, b.investment?.currency) : "—",
        ]);

        const lines = [`Found ${bookings.length} booking(s):`, "", formatTable(headers, rows)];

        if (data.paging && data.paging.pageCount > 1) {
          lines.push("", `Showing ${bookings.length} of ${data.paging.totalCount} total.`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing bookings: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
