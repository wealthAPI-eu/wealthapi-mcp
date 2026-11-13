import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { ApiClientOptions } from "./api/client.js";
import { createServer } from "./server.js";

export type ConnectOptions = ApiClientOptions;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface ToolConnection {
  tools: ToolDefinition[];
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  close(): Promise<void>;
}

export async function connectTools(options: ConnectOptions): Promise<ToolConnection> {
  const client = await connectClient(options);
  const listed = await client.listTools();

  return {
    tools: listed.tools.map(toDefinition),
    call: (name, args) => callTool(client, name, args),
    close: () => client.close(),
  };
}

async function connectClient(options: ConnectOptions): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wealthapi-mcp-library", version: "0.1.0" });
  await createServer(options).connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function toDefinition(tool: {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema,
  };
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  return { text: joinText(result.content), isError: result.isError === true };
}

function joinText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n");
}
