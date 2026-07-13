import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type {
  ExtendedDateValuePair,
  ExtendedDateValuePairList,
  IncomeAndSpendingHistory,
  PageableTransactionList,
  Transaction,
} from "../api/types.js";
import { formatCurrency, formatDate, formatPercent, formatTable } from "../util/format.js";

export interface MonthlyCashFlow {
  month: string;
  income: number;
  spending: number;
  net: number;
}

export interface CashFlowAggregate {
  months: MonthlyCashFlow[];
  totalIncome: number;
  totalSpending: number;
  net: number;
  avgMonthlyIncome: number;
  avgMonthlySpending: number;
}

export function aggregateCashFlow(history: IncomeAndSpendingHistory): CashFlowAggregate {
  const byMonth = new Map<string, MonthlyCashFlow>();

  addToMonths(byMonth, history.averageRegularIncome, "income");
  addToMonths(byMonth, history.averageNonRegularIncome, "income");
  addToMonths(byMonth, history.averageRegularExpenses, "spending");
  addToMonths(byMonth, history.averageNonRegularExpenses, "spending");

  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const m of months) m.net = m.income - m.spending;

  const totalIncome = sum(months.map((m) => m.income));
  const totalSpending = sum(months.map((m) => m.spending));
  const n = months.length || 1;

  return {
    months,
    totalIncome,
    totalSpending,
    net: totalIncome - totalSpending,
    avgMonthlyIncome: totalIncome / n,
    avgMonthlySpending: totalSpending / n,
  };
}

function addToMonths(
  byMonth: Map<string, MonthlyCashFlow>,
  list: ExtendedDateValuePairList | undefined,
  bucket: "income" | "spending"
): void {
  if (!list?.extendedDateValuePairs) return;
  for (const pair of list.extendedDateValuePairs) {
    const month = monthKey(pair.date);
    if (!byMonth.has(month)) {
      byMonth.set(month, { month, income: 0, spending: 0, net: 0 });
    }
    const entry = byMonth.get(month)!;
    if (bucket === "income") {
      entry.income += pair.value;
    } else {
      entry.spending += Math.abs(pair.value);
    }
  }
}

function monthKey(date: string): string {
  return formatDate(date).slice(0, 7);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function computeSavingsRate(income: number, spending: number): number | null {
  if (income <= 0) return null;
  return ((income - spending) / income) * 100;
}

export function registerCashFlowTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "get_cash_flow_summary",
    {
      description:
        "Monthly income vs. spending for the user's cash accounts. Answers 'how much did I earn and spend?' over a period. Inflows are positive, outflows positive (spending), net = income − spending.",
      inputSchema: {
        from: z.string().describe("Start date (yyyy-MM-dd), required"),
        to: z.string().optional().describe("End date (yyyy-MM-dd), defaults to today"),
        accountId: z
          .array(z.number())
          .optional()
          .describe("Cash account ID(s) to scope to; omit for all accounts"),
        excludeTransfers: z
          .boolean()
          .default(true)
          .describe("Exclude inter-account transfers from analytics"),
      },
    },
    async ({ from, to, accountId, excludeTransfers }) => {
      try {
        const history = await client.get<IncomeAndSpendingHistory>(
          "/v1/cashFlowAnalytics/history",
          {
            from,
            to,
            id: accountId,
            enableTransferCategoryFiltering: excludeTransfers,
          }
        );

        const agg = aggregateCashFlow(history);
        if (agg.months.length === 0) {
          return { content: [{ type: "text" as const, text: "No cash flow data for this period." }] };
        }

        const headers = ["Month", "Income", "Spending", "Net"];
        const rows = agg.months.map((m) => [
          m.month,
          formatCurrency(m.income),
          formatCurrency(m.spending),
          formatCurrency(m.net),
        ]);

        const lines = [
          `Cash flow ${agg.months[0].month} → ${agg.months[agg.months.length - 1].month} (${agg.months.length} months):`,
          `Total income:   ${formatCurrency(agg.totalIncome)}`,
          `Total spending: ${formatCurrency(agg.totalSpending)}`,
          `Net:            ${formatCurrency(agg.net)}`,
          `Avg / month:    ${formatCurrency(agg.avgMonthlyIncome)} in, ${formatCurrency(agg.avgMonthlySpending)} out`,
          "",
          formatTable(headers, rows),
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting cash flow: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_savings_rate",
    {
      description:
        "Compute the user's savings rate over a period: (income − spending) / income, expressed as a percentage. Uses cash flow analytics. Higher is better; negative means the user spent more than they earned.",
      inputSchema: {
        from: z.string().describe("Start date (yyyy-MM-dd), required"),
        to: z.string().optional().describe("End date (yyyy-MM-dd), defaults to today"),
        accountId: z
          .array(z.number())
          .optional()
          .describe("Cash account ID(s) to scope to; omit for all accounts"),
        excludeTransfers: z
          .boolean()
          .default(true)
          .describe("Exclude inter-account transfers from analytics"),
      },
    },
    async ({ from, to, accountId, excludeTransfers }) => {
      try {
        const history = await client.get<IncomeAndSpendingHistory>(
          "/v1/cashFlowAnalytics/history",
          {
            from,
            to,
            id: accountId,
            enableTransferCategoryFiltering: excludeTransfers,
          }
        );

        const agg = aggregateCashFlow(history);
        if (agg.months.length === 0) {
          return { content: [{ type: "text" as const, text: "No cash flow data for this period." }] };
        }

        const rate = computeSavingsRate(agg.totalIncome, agg.totalSpending);
        const rateLine = rate === null
          ? "Savings rate: N/A (no income in period)"
          : `Savings rate: ${formatPercent(rate)}`;

        const lines = [
          `Period: ${agg.months[0].month} → ${agg.months[agg.months.length - 1].month} (${agg.months.length} months)`,
          `Income:   ${formatCurrency(agg.totalIncome)}`,
          `Spending: ${formatCurrency(agg.totalSpending)}`,
          `Net:      ${formatCurrency(agg.net)}`,
          rateLine,
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting savings rate: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "detect_recurring_transactions",
    {
      description:
        "List transactions flagged as regular (salary, rent, subscriptions, standing orders). Grouped by counterpart and direction, with detected payment interval (in months) and average amount. Use this to answer 'what subscriptions do I have?' or 'what are my fixed costs?'.",
      inputSchema: {
        accountId: z
          .array(z.number())
          .optional()
          .describe("Cash account ID(s) to scope to; omit for all accounts"),
        minDate: z.string().optional().describe("Start date (yyyy-MM-dd)"),
        maxDate: z.string().optional().describe("End date (yyyy-MM-dd)"),
        direction: z
          .enum(["all", "outflow", "inflow"])
          .default("all")
          .describe("Filter by direction: outflow (subscriptions/rent), inflow (salary), or all"),
        perPage: z
          .number()
          .default(500)
          .describe("Max transactions to scan (up to 500). Higher catches more recurrences."),
      },
    },
    async ({ accountId, minDate, maxDate, direction, perPage }) => {
      try {
        const data = await client.get<PageableTransactionList>("/v1/transactions", {
          accountId,
          minDate,
          maxDate,
          perPage,
        });
        const transactions = data.transactions ?? [];
        const recurring = transactions.filter((t) => t.isRegular === true);

        if (recurring.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No recurring transactions found in this period.",
              },
            ],
          };
        }

        const groups = groupRecurring(recurring, direction);
        if (groups.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No recurring ${direction === "all" ? "" : direction + " "}transactions in this period.`,
              },
            ],
          };
        }

        const headers = ["Counterpart", "Dir", "Interval", "Avg amount", "Count", "Last seen"];
        const rows = groups.map((g) => [
          g.label.slice(0, 32),
          g.direction,
          g.interval ? `${g.interval} mo` : "—",
          formatCurrency(g.averageAmount, g.currency),
          String(g.count),
          formatDate(g.lastSeen),
        ]);

        const monthly = monthlyEquivalent(groups);
        const lines = [
          `Found ${groups.length} recurring stream(s) across ${recurring.length} transaction(s):`,
          `Estimated monthly outflow: ${formatCurrency(monthly.outflow)}`,
          `Estimated monthly inflow:  ${formatCurrency(monthly.inflow)}`,
          "",
          formatTable(headers, rows),
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error detecting recurring transactions: ${errorMessage(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export interface RecurringGroup {
  label: string;
  direction: "in" | "out";
  interval: number | null;
  averageAmount: number;
  currency: string | undefined;
  count: number;
  lastSeen: string;
}

export function groupRecurring(
  transactions: Transaction[],
  direction: "all" | "inflow" | "outflow"
): RecurringGroup[] {
  const groups = new Map<string, RecurringGroup>();

  for (const t of transactions) {
    const dir: "in" | "out" = (t.amount ?? 0) >= 0 ? "in" : "out";
    if (direction === "inflow" && dir !== "in") continue;
    if (direction === "outflow" && dir !== "out") continue;

    const label = recurringLabel(t);
    const key = `${dir}|${label}|${t.paymentInterval ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if ((t.valueDate ?? "") > existing.lastSeen) existing.lastSeen = t.valueDate ?? "";
    } else {
      groups.set(key, {
        label,
        direction: dir,
        interval: t.paymentInterval ?? null,
        averageAmount: t.averageRegularAmount ?? t.amount ?? 0,
        currency: t.currency,
        count: 1,
        lastSeen: t.valueDate ?? "",
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount)
  );
}

function recurringLabel(t: Transaction): string {
  const name = (t.counterpartName ?? "").trim();
  if (name) return name;
  const purpose = (t.purpose ?? "").trim();
  return purpose || "—";
}

export function monthlyEquivalent(groups: RecurringGroup[]): { inflow: number; outflow: number } {
  let inflow = 0;
  let outflow = 0;
  for (const g of groups) {
    const interval = g.interval && g.interval > 0 ? g.interval : 1;
    const perMonth = Math.abs(g.averageAmount) / interval;
    if (g.direction === "in") inflow += perMonth;
    else outflow += perMonth;
  }
  return { inflow, outflow };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
