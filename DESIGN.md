# Agent Stack SDK — API Design

## Vision
One package to rule three layers: identity, payments, data. Developers should be able to build a fully capable paid AI agent service in under 50 lines of code.

## Package Structure (Monorepo)

```
@agent-stack/identity   — ERC-8004 registration + verification + discovery
@agent-stack/payments   — x402 client (paying) + server (receiving) helpers
@agent-stack/data       — MCP server/client with built-in identity + payment
@agent-stack/core       — The glue: AgentStack class that connects all three
```

---

## @agent-stack/identity

### Registration
```typescript
import { AgentIdentity } from "@agent-stack/identity";

const identity = new AgentIdentity({
  account,                          // viem Account (signer)
  chain: base,                      // viem Chain
  rpc: "https://...",               // optional, uses defaults
  // registry: "0x..."              // optional, defaults to 0x8004...
});

// Register on one chain
const { agentId, txHash } = await identity.register({
  name: "Arca",
  description: "AI assistant for web3 development.",
  image: "ipfs://QmXxx...",
  services: [
    { name: "MCP", endpoint: "https://mcp.arcabot.ai/", version: "2025-06-18" },
    { name: "web", endpoint: "https://arcabot.ai" },
  ],
  x402Support: true,
  active: true,
});

// Check if already registered
const { registered, agentId } = await identity.isRegistered();

// Update URI after deploy
await identity.setAgentURI(agentId, newJsonUri);
```

### Verification
```typescript
import { verifyAgent } from "@agent-stack/identity";

// Verify by global agent ID
const result = await verifyAgent("eip155:8453:0x8004...#2376");
// result.valid, result.registration, result.owner, result.paymentWallet

// Verify by chain + agentId
const result = await verifyAgent({ chain: base, agentId: 2376 });

// Verify by wallet address (find their registrations)
const agents = await findAgentsByOwner("0x1be93C...", { chain: base });
```

### Discovery
```typescript
import { discoverAgents } from "@agent-stack/identity";

// Find agents that expose MCP endpoints
const agents = await discoverAgents({
  chain: base,
  filter: {
    hasService: "MCP",        // has MCP endpoint
    x402Support: true,         // accepts payments
    active: true,
  }
});
// Returns: AgentRegistration[] with resolved registration files

// Resolve MCP endpoint for an agent
const mcpUrl = await getMcpEndpoint("eip155:8453:0x8004...#2376");
```

### Payment Wallet
```typescript
// Set payment wallet (proves control of new wallet via EIP-712 signature)
await identity.setPaymentWallet(agentId, newWalletAddress, deadline, signature);

// Get agent's payment wallet
const wallet = await identity.getPaymentWallet(agentId);
```

---

## @agent-stack/payments

### Client (paying)
```typescript
import { createPaymentClient } from "@agent-stack/payments";

const payer = createPaymentClient({
  account,             // viem Account
  chains: ["eip155:8453", "eip155:1"],   // supported chains
  // maxAmount: "1000000"  // optional: max USDC to auto-pay (safety limit)
});

// Simple: wrap fetch for auto-payment
const paidFetch = payer.fetch;
const response = await paidFetch("https://api.agent.eth/tool");

// Advanced: pay a specific agent by ERC-8004 global ID
const paidFetch = await payer.fetchForAgent("eip155:8453:0x8004...#2376");
// Automatically resolves payment wallet from ERC-8004

// Check your USDC balance
const balance = await payer.getBalance("eip155:8453");
// Returns: { amount: 1500000n, formatted: "1.500000", symbol: "USDC" }

// Decode payment receipt from response
const receipt = payer.decodeReceipt(response);
```

### Server (receiving)
```typescript
import { createPaymentServer } from "@agent-stack/payments";

const receiver = createPaymentServer({
  payTo: "0x1be93C...",          // payment recipient
  amount: "100000",              // 0.10 USDC in base units
  asset: USDC_BASE,              // token address
  chain: "eip155:8453",
  // facilitator?: optional custom facilitator URL
});

// Express-style middleware
app.use("/tool", receiver.middleware(), (req, res) => {
  // Payment already verified at this point
  const payment = res.locals.payment; // payment details
  res.json({ result: "paid data" });
});

// Manual: check if request has valid payment
const { valid, payment, error } = await receiver.verify(request);

// Manual: build payment requirements for 402 response
const requirements = receiver.buildRequirements({ description: "AI lookup" });
res.status(402).set("X-PAYMENT-REQUIRED", requirements).end();
```

---

## @agent-stack/data

### MCP Server with Built-in Identity + Payment
```typescript
import { createAgentMcpServer } from "@agent-stack/data";

const server = createAgentMcpServer({
  name: "Arca",
  version: "1.0.0",
  
  // Optional: auto-expose ERC-8004 identity as a resource
  identity: {
    chain: base,
    agentId: 2376,
    registry: "0x8004...",
  },
  
  // Optional: require payment before serving tools
  payment: {
    payTo: "0x1be93C...",
    amount: "10000",          // 0.01 USDC per call
    chain: "eip155:8453",
    freeTools: ["ping", "identity"],  // these tools don't require payment
  },
});

// Register tools normally (MCP API passthrough)
server.tool("get-price", { symbol: z.string() }, async ({ symbol }) => ({
  content: [{ type: "text", text: `Price: ${await fetchPrice(symbol)}` }]
}));

// Start (returns transport + express app)
const { app, transport } = await server.listen(3000);
```

### MCP Client with Auto-Payment
```typescript
import { createAgentMcpClient } from "@agent-stack/data";

// Connect by ERC-8004 global ID — auto-resolves MCP endpoint + pays if needed
const client = await createAgentMcpClient({
  agentId: "eip155:8453:0x8004...#2376",
  payer: {
    account,
    maxAmount: "100000",  // max 0.10 USDC per session
  },
});

const tools = await client.listTools();
const result = await client.callTool("get-price", { symbol: "ETH" });

// Connect by URL (plain MCP, no identity/payment)
const client = await createAgentMcpClient({ url: "https://mcp.agent.eth/" });
```

---

## @agent-stack/core

### All-in-One: AgentStack
```typescript
import { AgentStack } from "@agent-stack/core";

// Full agent setup in one shot
const agent = new AgentStack({
  // Identity
  account,                           // viem Account (signing)
  chain: base,
  
  // What to expose
  server: {
    name: "Arca",
    version: "1.0.0",
    port: 3000,
    payment: {
      amount: "10000",               // 0.01 USDC per call
    },
  },
});

// Register on-chain (once)
const { agentId } = await agent.register({
  name: "Arca",
  description: "Web3 AI assistant",
  x402Support: true,
});

// Add tools
agent.tool("analyze-contract", { address: z.string() }, async ({ address }) => {
  // Your logic here
  return { content: [{ type: "text", text: "Analysis complete" }] };
});

// Start — serves MCP endpoint and auto-handles payments
await agent.start();
// Now serving: http://localhost:3000/mcp
// Registered at: eip155:8453:0x8004...#2376

// Connect to another agent by identity
const client = await agent.connect("eip155:8453:0x8004...#9999");
const result = await client.callTool("do-something", {});
```

---

## Data Types

```typescript
// Global agent identifier
type AgentGlobalId = string; // "eip155:{chainId}:{registry}#{agentId}"

// Parsed agent reference
interface AgentRef {
  namespace: string;     // "eip155"
  chainId: number;       // 8453
  registry: `0x${string}`; // "0x8004..."
  agentId: number;       // 2376
}

// Agent registration file
interface AgentRegistration {
  type: string;
  name: string;
  description: string;
  image?: string;
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: AgentRef[];
  supportedTrust?: string[];
}

interface AgentService {
  name: string;       // "MCP" | "A2A" | "web" | "ENS" | ...
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
}

// Payment details
interface PaymentDetails {
  txHash?: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  chain: string;
  timestamp: number;
}

// Verification result
interface VerificationResult {
  valid: boolean;
  agentId: number;
  owner: string;
  paymentWallet: string | null;
  registration: AgentRegistration | null;
  error?: string;
}
```

---

## Design Principles

1. **Zero-config defaults** — sensible defaults for Base mainnet USDC
2. **Bring your own signer** — accepts viem Account objects, no key management
3. **Modular** — each package works standalone, core is opt-in
4. **Type-safe** — full TypeScript types, no `any`
5. **Fail loudly** — clear error messages with actionable hints
6. **Non-custodial** — SDK never holds or sends funds, only signs
7. **Composable** — each layer exposes its primitives, not just the happy path

---

## Dependency Graph

```
@agent-stack/core
  ├── @agent-stack/identity
  ├── @agent-stack/payments
  └── @agent-stack/data
        ├── @agent-stack/identity
        └── @agent-stack/payments

External deps:
  viem — blockchain interactions
  @x402/fetch — payment client
  @x402/evm — EVM payment scheme
  @modelcontextprotocol/sdk — MCP protocol
  zod — schema validation
```
