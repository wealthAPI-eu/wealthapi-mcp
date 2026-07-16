# wealthapi-mcp

A small **Model Context Protocol (MCP)** server that lets Claude (or any MCP-compatible
assistant) answer everyday portfolio questions about your wealthAPI account:

> "What did I spend the most money on last month?"
> "How is my portfolio performing this year?"
> "Show me my five biggest positions."
> "Which of my investments lost the most value?"

It runs locally on your machine. Your bearer token never leaves your computer.

## What is an MCP server?

MCP is an open protocol that lets an AI assistant call tools you control. The assistant
runs in one process (e.g. Claude Desktop); the MCP server runs as a separate process you
launch. They talk to each other over **stdio** using JSON-RPC: the assistant writes a
`tools/call` message to the server's stdin, the server runs the tool and writes the
result back to its stdout. That's the whole protocol.

Note the distinction: this is an **MCP server**, not an MCP *plugin*. There is no such
thing as an MCP plugin — plugins (e.g. Claude Code plugins) extend the assistant itself,
while an MCP server is a standalone process the assistant connects to over the protocol.
Any MCP-compatible client (Claude Desktop, Claude Code, others) can use this server.

Concretely, this repo is a Node script. When Claude Desktop starts it, the script
registers its tools, waits for tool calls, and when one arrives, makes an HTTPS request
to the wealthAPI REST API on your behalf and returns a text summary. No state, no
database, no server to maintain.

Read more at https://modelcontextprotocol.io.

## The tools

Auth is a wealthAPI API token (`wapi_key_…`) carrying the read scopes (`accounts:read`,
`investments:read`, `transactions:read`, `profile:read`). All tools are read-only.

### Accounts & cash flow

| Tool | Wraps | Answers |
|---|---|---|
| `list_accounts` | `GET /api/v1/accounts` | "What accounts do I have?" |
| `get_account_balances` | `GET /api/v1/accounts/balances` | "Show my cash balance history" |
| `get_portfolio_valuation` | `GET /api/v1/accounts/valuation` (+ `historicValuations`) | "What is my portfolio worth (today / over time)?" |
| `list_transactions` | `GET /api/v1/transactions` | "What did I spend most on last month?" |
| `detect_recurring_transactions` | `GET /api/v1/transactions` | "What subscriptions / fixed costs do I have?" |
| `list_bookings` | `GET /api/v1/bookings` | "Show my buys / sells / dividends" |
| `get_cash_flow_summary` | `GET /api/v1/cashFlowAnalytics/history` | "Income vs spending per month" |
| `get_savings_rate` | `GET /api/v1/cashFlowAnalytics/history` | "What's my savings rate?" |

### Portfolio & performance

| Tool | Wraps | Answers |
|---|---|---|
| `list_investments` | `GET /api/v2/investments` | "What do I own and what is it worth?" |
| `get_gainers_and_losers` | `GET /api/v1/investments/gainersAndLosers` | "Best / worst performers" |
| `get_portfolio_performance` | `POST /api/v2/performance` | "How did my portfolio do this year?" |
| `get_portfolio_allocation` | `GET /api/v1/investments` | "How diversified am I by region / sector / asset type?" |
| `get_risk_metrics` | `GET /api/v1/riskYieldMetrics` (+ `/investments`) | "How risky is my portfolio?" |
| `get_realized_gains` | `GET /api/v1/performance/realizedGains` | "What did I realize this year?" (tax season) |

### Dividends

| Tool | Wraps | Answers |
|---|---|---|
| `get_dividend_history` | `GET /api/v1/dividends/history` | "How much dividend income did I get per year / month?" |
| `get_dividend_calendar` | `GET /api/v1/dividends/calendar` | "When are my next dividend payments?" |
| `get_portfolio_yield` | `GET /api/v1/dividends/portfolioYield` | "What's my dividend yield?" |

### Market data & profile

| Tool | Wraps | Answers |
|---|---|---|
| `search_symbols` | `GET /api/v2/symbols` | "Find Apple / this ISIN" |
| `get_quotes` | `GET /api/v2/quotes` | "What's the current price?" |
| `get_security_fundamentals` | `GET /api/v1/fundamentals/{isin}` (+ `/statistics`) | "Is this stock expensive?" (P/E, P/B, F-Score) |
| `whoami` | `GET /api/v1/users/myself` | "Which account is this?" |

The server also registers prompts (`monthly_review`, `savings_rate_check`,
`subscription_audit`, `fixed_costs_summary`, `financial_health_check`) that chain these
tools into guided analyses.

Tool registration is gated by `SUPPORTED_TOOLS`/`SUPPORTED_PROMPTS` in `src/index.ts` —
remove a name there to disable it without deleting code.

## Install

You need Node 20+ and pnpm.

```bash
git clone git@github.com:wealthAPI-eu/wealthapi-mcp.git
cd wealthapi-mcp
pnpm install
pnpm build
```

Get a personal bearer token from wealthAPI (your account → API settings).

Add the server to Claude Desktop's config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "wealthapi": {
      "command": "node",
      "args": ["/absolute/path/to/wealthapi-mcp/build/index.js"],
      "env": {
        "BEARER_TOKEN": "paste-your-token-here",
        "WEALTHAPI_BASE_URL": "https://www.wealthapi.eu/api"
      }
    }
  }
}
```

Restart Claude Desktop. The active tools will appear in the tools panel of any chat,
and you can ask portfolio questions in plain English.

## How to add a new tool

The canonical example lives in `src/tools/accounts.ts` — `list_accounts` is ~50 lines
and shows the whole pattern.

1. Create or open the relevant file under `src/tools/` and write a
   `register*Tools(server, client)` function that calls `server.registerTool(...)`.
   Each call takes a name, a `{ description, inputSchema }` object (Zod for the
   input schema), and an async handler that returns `{ content: [{ type: "text", text }] }`.
2. Import and call your `register*Tools` from `src/index.ts`.
3. `pnpm build` and restart Claude Desktop.

That's it. No code generation, no registration files, no boilerplate.

## Layout

```
src/
  index.ts          Bootstrap: McpServer + StdioServerTransport + register*Tools(...)
  config.ts         Reads BEARER_TOKEN + WEALTHAPI_BASE_URL from env
  api/
    client.ts       fetch wrapper: GET/POST, query strings, retry on 5xx/429
    types.ts        TS interfaces for API response shapes
  tools/
    accounts.ts     list_accounts, get_account_balances, get_portfolio_valuation
    allocation.ts   get_portfolio_allocation
    cash-flow.ts    get_cash_flow_summary, get_savings_rate, detect_recurring_transactions
    dividends.ts    get_dividend_history, get_dividend_calendar, get_portfolio_yield
    investments.ts  list_investments, get_gainers_and_losers
    performance.ts  get_portfolio_performance, get_realized_gains
    risk.ts         get_risk_metrics
    securities.ts   search_symbols, get_quotes, get_security_fundamentals
    transactions.ts list_transactions, list_bookings
    user.ts         whoami
  util/
    logger.ts       Pino → stderr (stdout is reserved for MCP)
    format.ts       formatCurrency, formatDate, formatTable
test/
  api/
    client.test.ts  Vitest unit test for the query-string builder
  tools/
    *.test.ts       Unit tests for the pure aggregation helpers
```

## Run tests

```bash
pnpm test
```
