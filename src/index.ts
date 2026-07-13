#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ApiClient } from "./api/client.js";
import { logger } from "./util/logger.js";
import { restrictServer } from "./util/tool-allowlist.js";

import { registerAccountTools } from "./tools/accounts.js";
import { registerCashFlowTools } from "./tools/cash-flow.js";
import { registerInvestmentTools } from "./tools/investments.js";
import { registerPerformanceTools } from "./tools/performance.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerCashFlowPrompts } from "./prompts/cash-flow.js";

const SUPPORTED_TOOLS = new Set([
  "list_accounts",
  "list_transactions",
  "detect_recurring_transactions",
]);

const SUPPORTED_PROMPTS = new Set(["subscription_audit", "fixed_costs_summary"]);

const INSTRUCTIONS = `You help the user understand their personal finances on wealthAPI.

You have read-only access to the user's accounts and transactions via tools. The user is
authenticated — you act as them.

When the user asks a vague question, start with list_accounts to ground yourself, then drill in:
  - For "what subscriptions do I have" or "fixed costs", use detect_recurring_transactions.
  - For individual line items ("did I pay X?") or "what did I spend most on", use list_transactions.

Always quote concrete numbers, currencies and dates. Be concise.`;

async function main(): Promise<void> {
  logger.info("Starting wealthapi-mcp");

  const client = new ApiClient();

  const server = new McpServer(
    { name: "wealthapi-mcp", version: "0.1.0" },
    { instructions: INSTRUCTIONS }
  );

  const gated = restrictServer(server, {
    tools: SUPPORTED_TOOLS,
    prompts: SUPPORTED_PROMPTS,
  });

  registerAccountTools(gated, client);
  registerInvestmentTools(gated, client);
  registerPerformanceTools(gated, client);
  registerTransactionTools(gated, client);
  registerCashFlowTools(gated, client);
  registerCashFlowPrompts(gated);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("wealthapi-mcp connected via stdio");
}

main().catch((error) => {
  logger.error({ error: String(error) }, "Fatal error");
  process.exit(1);
});
