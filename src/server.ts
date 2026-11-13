import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ApiClient, type ApiClientOptions } from "./api/client.js";
import { restrictServer } from "./util/tool-allowlist.js";

import { registerAccountTools } from "./tools/accounts.js";
import { registerAllocationTools } from "./tools/allocation.js";
import { registerCashFlowTools } from "./tools/cash-flow.js";
import { registerDividendTools } from "./tools/dividends.js";
import { registerInvestmentTools } from "./tools/investments.js";
import { registerPerformanceTools } from "./tools/performance.js";
import { registerRiskTools } from "./tools/risk.js";
import { registerSecurityTools } from "./tools/securities.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerUserTools } from "./tools/user.js";
import { registerCashFlowPrompts } from "./prompts/cash-flow.js";

const SUPPORTED_TOOLS = new Set([
  "list_accounts",
  "get_account_balances",
  "get_portfolio_valuation",
  "list_transactions",
  "detect_recurring_transactions",
  "list_bookings",
  "get_cash_flow_summary",
  "get_savings_rate",
  "list_investments",
  "get_gainers_and_losers",
  "get_portfolio_performance",
  "get_realized_gains",
  "get_portfolio_allocation",
  "get_risk_metrics",
  "get_dividend_history",
  "get_dividend_calendar",
  "get_portfolio_yield",
  "search_symbols",
  "get_quotes",
  "get_security_fundamentals",
  "whoami",
]);

const SUPPORTED_PROMPTS = new Set([
  "monthly_review",
  "savings_rate_check",
  "subscription_audit",
  "fixed_costs_summary",
  "financial_health_check",
]);

const INSTRUCTIONS = `You help the user understand their personal finances on wealthAPI.

You have read-only access to the user's accounts, transactions, investments, performance,
dividends and risk metrics via tools. The user is authenticated — you act as them.

When the user asks a vague question, start with list_accounts to ground yourself, then drill in:
  - Cash flow: detect_recurring_transactions for subscriptions/fixed costs, list_transactions
    for line items, get_cash_flow_summary and get_savings_rate for income vs spending.
  - Portfolio: list_investments for holdings, get_portfolio_valuation for total value,
    get_portfolio_performance for TWROR, get_portfolio_allocation for diversification,
    get_risk_metrics for volatility, get_gainers_and_losers for movers.
  - Income from investments: get_dividend_history, get_dividend_calendar, get_portfolio_yield,
    get_realized_gains.
  - Market data: search_symbols to resolve a name/ISIN, then get_quotes or
    get_security_fundamentals.

Always quote concrete numbers, currencies and dates. Be concise.`;

export function createServer(options: ApiClientOptions): McpServer {
  const client = new ApiClient(options);
  const server = new McpServer(
    { name: "wealthapi-mcp", version: "0.1.0" },
    { instructions: INSTRUCTIONS }
  );
  const gated = restrictServer(server, {
    tools: SUPPORTED_TOOLS,
    prompts: SUPPORTED_PROMPTS,
  });

  registerAccountTools(gated, client);
  registerAllocationTools(gated, client);
  registerCashFlowTools(gated, client);
  registerDividendTools(gated, client);
  registerInvestmentTools(gated, client);
  registerPerformanceTools(gated, client);
  registerRiskTools(gated, client);
  registerSecurityTools(gated, client);
  registerTransactionTools(gated, client);
  registerUserTools(gated, client);
  registerCashFlowPrompts(gated);

  return server;
}
