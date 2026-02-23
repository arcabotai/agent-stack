# Agent Stack SDK

> **One package to connect three layers of agent infrastructure: identity, payments, and data.**

Built by [arcabot.ai](https://arcabot.ai) — the Farcaster Agent Launchpad.

---

## The Problem

The agent infra stack has three layers being built by different teams with no coordination:

| Layer | Tech | Status |
|-------|------|--------|
| **Identity** | ERC-8004 (on-chain agent registration) | Deployed on 16+ chains, no SDK |
| **Payments** | x402 protocol, Circle USDC | npm packages exist, no agent integration |
| **Data** | MCP servers, onchain oracles | SDK exists, no identity/payment layer |

None of these layers talk to each other. This SDK is the glue.

---

## What You Can Build

```typescript
import { AgentStack } from "@agent-stack/core";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const agent = new AgentStack({
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
  chain: base,
  server: {
    name: "MyAgent",
    payment: { amount: "1000" }, // 0.001 USDC per call
  },
});

agent.tool("analyze", { query: z.string() }, async ({ query }) => ({
  content: [{ type: "text", text: `Analysis: ${query}` }],
}));

await agent.start(); // serves MCP at http://localhost:3000/mcp
```

Another agent connects and pays automatically:

```typescript
const client = await createAgentMcpClient({
  agentId: "eip155:8453:0x8004...#42", // ERC-8004 global ID
  payer: { account },                    // x402 auto-payment
});

const result = await client.callTool("analyze", { query: "ETH price trend" });
// Payment of 0.001 USDC happened automatically
```

---

## Packages

```
@agent-stack/identity   — ERC-8004 registration, verification, discovery
@agent-stack/payments   — x402 client (paying) + server (receiving)
@agent-stack/data       — MCP server/client with identity + payment
@agent-stack/core       — The glue: AgentStack class + all re-exports
```

Use them independently or together via `@agent-stack/core`.

---

## Installation

```bash
# All-in-one
npm install @agent-stack/core viem @x402/fetch @x402/evm @modelcontextprotocol/sdk zod

# Or modular
npm install @agent-stack/identity viem
npm install @agent-stack/payments @x402/fetch @x402/evm viem
npm install @agent-stack/data @modelcontextprotocol/sdk viem zod
```

---

## API Reference

### `@agent-stack/identity`

#### Register an agent

```typescript
import { AgentIdentity } from "@agent-stack/identity";
import { base } from "viem/chains";

const identity = new AgentIdentity({ account, chain: base });

const { agentId, globalId } = await identity.register({
  name: "MyAgent",
  description: "An AI agent that does X",
  services: [
    { name: "MCP", endpoint: "https://mcp.myagent.ai/mcp", version: "2025-06-18" },
    { name: "web", endpoint: "https://myagent.ai" },
  ],
  x402Support: true,
  active: true,
});
// globalId: "eip155:8453:0x8004...#42"
```

#### Verify another agent

```typescript
import { verifyAgent } from "@agent-stack/identity";

const result = await verifyAgent("eip155:8453:0x8004...#2376");
// result.valid — on-chain ownership + back-reference check
// result.owner — owner address
// result.paymentWallet — payment wallet (if set)
// result.registration — full registration file
```

#### Resolve MCP endpoint

```typescript
import { getMcpEndpoint } from "@agent-stack/identity";

const url = await getMcpEndpoint("eip155:8453:0x8004...#2376");
// "https://mcp.arcabot.ai/mcp"
```

---

### `@agent-stack/payments`

#### Pay other agents (client)

```typescript
import { createPaymentClient } from "@agent-stack/payments";

const payer = createPaymentClient({ account });

// Auto-pays x402 requirements
const response = await payer.fetch("https://api.paidagent.ai/tool");

// Check balance
const balance = await payer.getBalance("eip155:8453");
// { amount: 1500000n, formatted: "1.500000", symbol: "USDC" }

// Decode payment receipt from response
const receipt = payer.decodeReceipt(response);
```

#### Accept payments (server)

```typescript
import { createPaymentServer } from "@agent-stack/payments";

const receiver = createPaymentServer({
  payTo: "0x1be93C...",
  amount: "100000",    // 0.10 USDC
  network: "eip155:8453",
  description: "My AI tool",
});

// Express middleware
app.use("/tool", receiver.middleware(), (req, res) => {
  // Payment verified — req.payment has details
  res.json({ result: "paid content" });
});

// Build payment requirements for manual 402
const requirements = receiver.buildRequirements("https://myapi.ai/tool");
```

---

### `@agent-stack/data`

#### Create a paid MCP server

```typescript
import { createAgentMcpServer } from "@agent-stack/data";
import { z } from "zod";

const server = createAgentMcpServer({
  name: "DataAgent",
  version: "1.0.0",
  
  identity: {
    chainId: 8453,
    agentId: 2376,
    // auto-exposes "agent://identity" resource
  },
  
  payment: {
    payTo: "0x1be93C...",
    amount: "10000",    // 0.01 USDC
    freeTools: ["ping"],
  },
});

server.tool("get-data", { query: z.string() }, async ({ query }) => ({
  content: [{ type: "text", text: await fetchData(query) }],
}));

const { url } = await server.listen(3000);
// Serving at http://localhost:3000/mcp
// Returns 402 if payment header missing
```

#### Connect to an MCP server

```typescript
import { createAgentMcpClient } from "@agent-stack/data";

// By ERC-8004 identity (auto-resolves URL + pays)
const client = await createAgentMcpClient({
  agentId: "eip155:8453:0x8004...#2376",
  payer: { account, maxAmount: "100000" },
});

// By direct URL (no identity check)
const client = await createAgentMcpClient({ url: "https://mcp.agent.ai/mcp" });

const tools = await client.listTools();
const result = await client.callTool("get-data", { query: "ETH" });
const identity = await client.getAgentIdentity(); // reads agent://identity resource
await client.close();
```

---

### `@agent-stack/core`

The `AgentStack` class is the all-in-one interface:

```typescript
import { AgentStack } from "@agent-stack/core";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const agent = new AgentStack({
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
  chain: base,
  server: {
    name: "MyAgent",
    version: "1.0.0",
    port: 3000,
    payment: {
      amount: "10000",   // 0.01 USDC per call
      // payTo defaults to this wallet
    },
  },
});

// Register tools
agent.tool("my-tool", "Does a thing", { input: z.string() }, async ({ input }) => ({
  content: [{ type: "text", text: `Result: ${input}` }],
}));

// Start MCP server
const { url } = await agent.start();

// Register on-chain (once, costs gas)
// const { agentId, globalId } = await agent.register({
//   name: "MyAgent",
//   description: "...",
//   x402Support: true,
//   includeServerEndpoint: true, // auto-adds MCP URL to services
// });

// Connect to another agent
const client = await agent.connect("eip155:8453:0x8004...#9999");
const result = await client.callTool("some-tool", {});

// Verify identity
const verification = await agent.verify("eip155:8453:0x8004...#9999");

// Check balance
const balance = await agent.getBalance();

// Stop server
await agent.stop();
```

---

## Technical Architecture

### The Full Flow (Agent A → Agent B)

```
1. A looks up B by global ID: "eip155:8453:0x8004...#2376"
   └── Reads ERC-8004 registry on Base
   └── Gets owner, payment wallet, tokenURI

2. A fetches B's registration file (data URI / IPFS / HTTPS)
   └── Verifies back-reference (agentId + registry match)
   └── Parses services array → finds MCP endpoint
   └── Checks x402Support flag

3. A connects to B's MCP endpoint
   └── Uses payment-wrapped fetch (@x402/fetch)
   └── First call: normal HTTP request
   └── B returns 402 + payment requirements
   └── Client auto-signs EIP-3009 authorization (gasless)
   └── Retry with X-PAYMENT header

4. B's MCP server verifies payment
   └── Extracts signature from X-PAYMENT header
   └── Validates EIP-3009 authorization structure
   └── (Facilitator settles on-chain)
   └── Returns tool result

5. A processes result
   └── Payment receipt in X-PAYMENT-RESPONSE header
   └── Optional: post feedback to Reputation Registry
```

### Protocol Versions

| Protocol | Version | Package |
|----------|---------|---------|
| x402 | v2 (CAIP-2) | `@x402/fetch` + `@x402/evm` v2.4.0 |
| ERC-8004 | draft (2025-08-13) | Custom (this SDK) |
| MCP | 2025-06-18 | `@modelcontextprotocol/sdk` v1.26.0 |

### Key Addresses (Base mainnet)

| Contract | Address |
|----------|---------|
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

### Our Deployments

- Registered on 16 chains (Ethereum, Base, Arbitrum, Polygon, Optimism, Celo, BNB, Gnosis, Linea, Scroll, Taiko, Avalanche, Mantle, Metis, Abstract, Monad)
- Wallet: `0x1be93C700dDC596D701E8F2106B8F9166C625Adb` (arcabot.eth)
- Base agent ID: #2376

---

## Examples

| File | Description |
|------|-------------|
| `examples/01-register-agent.ts` | Register on-chain via ERC-8004 |
| `examples/02-paid-mcp-server.ts` | Build a paid MCP server |
| `examples/03-mcp-client.ts` | Connect to a paid MCP server |
| `examples/04-full-agent-stack.ts` | Full AgentStack class demo |
| `examples/05-agent-to-agent-payment.ts` | Full agent-to-agent payment flow |

---

## Design Principles

1. **Zero-config defaults** — Base + USDC sensible defaults
2. **Bring your own signer** — accepts viem Account objects, no key custody
3. **Modular** — each package is standalone, core is opt-in
4. **Non-custodial** — SDK never holds funds; only creates off-chain signatures
5. **Fail loudly** — clear error messages with actionable hints
6. **Type-safe** — full TypeScript throughout, no `any`

---

## What's NOT in this SDK

- **Reputation Registry** — posting/fetching feedback (planned v0.2)
- **Validation Registry** — zkML/TEE attestations (planned v0.3)
- **Agent discovery indexer** — off-chain indexing of registrations (planned)
- **Streaming payments** — Circle streaming USDC (planned v0.2)
- **Multi-chain discovery** — searching across all ERC-8004 chains (planned)

---

## Context

This SDK is the infrastructure backbone for the **Farcaster Agent Launchpad** — a turnkey agent deployment service by [arcabot.ai](https://arcabot.ai).

Contact: arca@arcabot.ai

---

## License

MIT
