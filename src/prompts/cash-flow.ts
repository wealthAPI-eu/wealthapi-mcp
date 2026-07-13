import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function userPrompt(text: string) {
  return {
    messages: [
      { role: "user" as const, content: { type: "text" as const, text } },
    ],
  };
}

export function registerCashFlowPrompts(server: McpServer): void {
  server.registerPrompt(
    "monthly_review",
    {
      description: "Walk through the user's income vs. spending month by month over a period.",
      argsSchema: {
        from: z.string().describe("Start date (yyyy-MM-dd)"),
        to: z.string().optional().describe("End date (yyyy-MM-dd), defaults to today"),
      },
    },
    ({ from, to }) =>
      userPrompt(
        `Give me a month-by-month review of my cash flow from ${from} to ${to ?? "today"}. ` +
          `Call get_cash_flow_summary, then call out the months with the highest spending or unusual net.`
      )
  );

  server.registerPrompt(
    "savings_rate_check",
    {
      description: "Compute the user's savings rate over a period and explain how it compares.",
      argsSchema: {
        from: z.string().describe("Start date (yyyy-MM-dd)"),
        to: z.string().optional().describe("End date (yyyy-MM-dd), defaults to today"),
      },
    },
    ({ from, to }) =>
      userPrompt(
        `What's my savings rate from ${from} to ${to ?? "today"}? ` +
          `Use get_savings_rate. State the rate, the absolute amounts, and one sentence on whether ` +
          `that's healthy (rule of thumb: 10–20% is decent, >20% is strong).`
      )
  );

  server.registerPrompt(
    "subscription_audit",
    {
      description: "List recurring outflows so the user can spot subscriptions worth cancelling.",
      argsSchema: {
        minDate: z.string().optional().describe("Only consider transactions on/after this date (yyyy-MM-dd)"),
      },
    },
    ({ minDate }) =>
      userPrompt(
        `Audit my recurring outflows. Call detect_recurring_transactions with direction=outflow` +
          (minDate ? ` and minDate=${minDate}` : "") +
          `. Group the result for me, highlight the most expensive recurring streams, and flag anything ` +
          `that looks like it could be a forgotten subscription (small monthly charge, generic counterpart).`
      )
  );

  server.registerPrompt(
    "fixed_costs_summary",
    {
      description: "Estimate the user's fixed monthly cost base from recurring outflows.",
      argsSchema: {},
    },
    () =>
      userPrompt(
        `What are my fixed monthly costs? Call detect_recurring_transactions with direction=outflow, ` +
          `take the estimated monthly outflow figure, and break it down into categories (housing, ` +
          `utilities, subscriptions, insurance, other) based on the counterpart names.`
      )
  );

  server.registerPrompt(
    "financial_health_check",
    {
      description: "Run a full personal-finance check: cash flow, savings rate, and recurring costs.",
      argsSchema: {
        from: z.string().describe("Start date (yyyy-MM-dd) for the lookback window"),
      },
    },
    ({ from }) =>
      userPrompt(
        `Give me a financial health check from ${from} to today. Do all of the following and then ` +
          `summarize at the end:\n` +
          `1. get_cash_flow_summary — total income, spending, net.\n` +
          `2. get_savings_rate — the headline rate.\n` +
          `3. detect_recurring_transactions direction=outflow — what's my fixed cost base?\n` +
          `Finish with three concrete suggestions tailored to what you found.`
      )
  );
}
