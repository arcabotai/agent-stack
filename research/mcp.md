# MCP (Model Context Protocol) Research

## Overview
MCP is Anthropic's open protocol for connecting AI models to external data and tools. It standardizes how LLMs get context, tools, and prompts from external servers.

## NPM Package
- `@modelcontextprotocol/sdk` v1.26.0 (MIT license)
- Maintained by Anthropic team
- 75 versions published — very active development
- Required peer dep: `zod`

## Architecture

### Server-Side
An MCP server exposes:
- **Tools**: Actions the LLM can invoke (read/write side effects)
- **Resources**: Read-only data (files, databases, live feeds)
- **Prompts**: Reusable prompt templates

### Client-Side
An MCP client connects to servers and:
- Lists available tools/resources/prompts
- Calls tools with arguments
- Reads resources at URIs
- Gets prompts filled with arguments

## Transport Layers
1. **Streamable HTTP** (recommended for remote servers) — SSE + HTTP
2. **HTTP + SSE** (backwards compat only)
3. **stdio** (local process-spawned integrations)

## Key Classes

### McpServer (high-level)
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({ name: "MyAgent", version: "1.0.0" });

// Register a tool
server.tool("lookup-price", { symbol: z.string() }, async ({ symbol }) => ({
  content: [{ type: "text", text: `Price of ${symbol}: $42,000` }]
}));

// Register a resource
server.resource("agent-profile", "agent://profile", async (uri) => ({
  contents: [{ uri: uri.href, text: JSON.stringify(profile) }]
}));

// Start serving
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
await server.connect(transport);
// Attach transport to your HTTP server
```

### Client (high-level)
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "MyApp", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("https://mcp.agent.eth/"));
await client.connect(transport);

const tools = await client.listTools();
const result = await client.callTool({ name: "lookup-price", arguments: { symbol: "BTC" } });
const profile = await client.readResource({ uri: "agent://profile" });
```

## Advanced Features
- **Sampling**: Servers can ask clients to run LLM completions
- **Form elicitation**: Tools can request structured user input
- **URL elicitation**: Servers can open browser flows (OAuth, payments)
- **Tasks (experimental)**: Long-running tool calls with polling/resume

## Capabilities Negotiation
Client and server exchange capabilities on connect:
- `tools`, `resources`, `prompts` (listing and updates)
- `sampling` (server-initiated LLM calls)
- `elicitation` (user input requests)

## Integration with ERC-8004
ERC-8004 registration explicitly includes MCP endpoints:
```json
{ "name": "MCP", "endpoint": "https://mcp.agent.eth/", "version": "2025-06-18" }
```

This means:
1. Agent registers on-chain with their MCP URL
2. Other agents/clients discover via ERC-8004
3. Connect to MCP endpoint and use tools/resources

## Integration with x402
No native integration exists yet. Possible pattern:
1. MCP server middleware checks for payment header before serving tools
2. Client pre-pays via x402 before connecting
3. Server validates payment and includes receipt in tool response metadata

## What the SDK Adds
The key missing piece: **zero-config MCP server that automatically exposes ERC-8004 identity as a resource + validates payments before tool execution**.
