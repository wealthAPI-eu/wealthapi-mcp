#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./config.js";
import { createServer } from "./server.js";
import { logger } from "./util/logger.js";

async function main(): Promise<void> {
  logger.info("Starting wealthapi-mcp");

  const server = createServer({ baseUrl: config.apiBaseUrl, token: config.bearerToken });
  await server.connect(new StdioServerTransport());

  logger.info("wealthapi-mcp connected via stdio");
}

main().catch((error) => {
  logger.error({ error: String(error) }, "Fatal error");
  process.exit(1);
});
