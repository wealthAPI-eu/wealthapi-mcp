import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";

export interface Allowlists {
  tools: Set<string>;
  prompts: Set<string>;
}

export function restrictServer(server: McpServer, allowed: Allowlists): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "registerTool") {
        return gate(target.registerTool.bind(target), allowed.tools, "tool");
      }
      if (prop === "registerPrompt") {
        return gate(target.registerPrompt.bind(target), allowed.prompts, "prompt");
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function gate<T extends (name: string, ...rest: never[]) => unknown>(
  register: T,
  allowed: Set<string>,
  kind: string
): T {
  return ((name: string, ...rest: never[]) => {
    if (!allowed.has(name)) {
      logger.debug({ [kind]: name }, "Skipping registration not covered by API token");
      return undefined;
    }
    return register(name, ...rest);
  }) as T;
}
