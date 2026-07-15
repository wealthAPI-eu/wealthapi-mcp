import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import type { User } from "../api/types.js";
import { formatDate } from "../util/format.js";

export function registerUserTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    "whoami",
    {
      description:
        "Show which wealthAPI user this session is acting as (name, email, member since). Use this to ground yourself or when the user asks 'which account is this?'.",
      inputSchema: {},
    },
    async () => {
      try {
        const user = await client.get<User>("/v1/users/myself");

        const lines = [
          `Acting as: ${user.name ?? "N/A"}`,
          `Email: ${user.email ?? "N/A"}${user.isEmailConfirmed ? " (confirmed)" : ""}`,
          `Member since: ${user.userCreatedAt ? formatDate(user.userCreatedAt) : "N/A"}`,
        ];

        if (user.thirdPartyAccounts && user.thirdPartyAccounts.length > 0) {
          lines.push(`Connected providers: ${user.thirdPartyAccounts.join(", ")}`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error getting user info: ${errorMessage(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
