/**
 * Example 2: Build a paid MCP server
 *
 * Creates an MCP server that:
 * - Exposes the agent's ERC-8004 identity as a resource
 * - Requires 0.001 USDC payment per tool call
 * - Serves market data tools
 *
 * Run:
 *   node --loader ts-node/esm 02-paid-mcp-server.ts
 */

import { z } from "zod";
import { createAgentMcpServer } from "@a3stack/data";
import { USDC_BASE } from "@a3stack/payments";

const MY_WALLET = process.env.PAYMENT_WALLET ?? "YOUR_WALLET_ADDRESS";
const MY_AGENT_ID = Number(process.env.AGENT_ID ?? 0);

async function fetchPrice(symbol: string): Promise<number> {
  // Mock price fetch — replace with real API
  const prices: Record<string, number> = {
    ETH: 2800,
    BTC: 43000,
    USDC: 1.00,
  };
  return prices[symbol.toUpperCase()] ?? 0;
}

async function main() {
  const server = createAgentMcpServer({
    name: "MarketDataAgent",
    version: "1.0.0",
    port: 3000,

    // Expose on-chain identity as a resource
    identity: {
      chainId: 8453, // Base
      agentId: MY_AGENT_ID,
    },

    // Require 0.001 USDC per tool call
    payment: {
      payTo: MY_WALLET,
      amount: "1000",          // 0.001000 USDC (6 decimals)
      asset: USDC_BASE,
      network: "eip155:8453",  // Base mainnet
      description: "MarketDataAgent: 0.001 USDC per call",
      freeTools: ["ping"],     // ping is always free
    },
  });

  // Register tools
  server.tool(
    "get-price",
    "Get the current price of a cryptocurrency",
    { symbol: z.string().describe("Token symbol, e.g. ETH, BTC") },
    async ({ symbol }) => {
      const price = await fetchPrice(symbol as string);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ symbol, price, currency: "USD", timestamp: Date.now() }),
          },
        ],
      };
    }
  );

  server.tool(
    "get-market-summary",
    "Get a market summary for multiple tokens",
    {
      symbols: z.array(z.string()).describe("List of token symbols"),
    },
    async ({ symbols }) => {
      const results: Record<string, number> = {};
      for (const sym of symbols as string[]) {
        results[sym] = await fetchPrice(sym);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              prices: results,
              timestamp: Date.now(),
              paidWith: "x402 USDC on Base",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "analyze-token",
    "Get detailed analysis for a token (premium tool)",
    {
      symbol: z.string().describe("Token symbol"),
      depth: z.enum(["basic", "detailed"]).default("basic"),
    },
    async ({ symbol, depth }) => {
      const price = await fetchPrice(symbol as string);
      const analysis = {
        symbol,
        price,
        depth,
        sentiment: price > 2000 ? "bullish" : "bearish",
        recommendation: "DYOR — not financial advice",
        timestamp: Date.now(),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(analysis) }],
      };
    }
  );

  // Start server
  const { url } = await server.listen();
  console.log(`\n🤖 MarketDataAgent MCP Server running!`);
  console.log(`   URL: ${url}`);
  console.log(`   Payment: 0.001 USDC on Base per call`);
  console.log(`   Identity: eip155:8453:0x8004...#${MY_AGENT_ID}`);
  console.log(`\nTools available:`);
  console.log(`   - ping (free)`);
  console.log(`   - get-price (paid)`);
  console.log(`   - get-market-summary (paid)`);
  console.log(`   - analyze-token (paid)`);
  console.log(`\nResources:`);
  console.log(`   - agent://identity (ERC-8004 registration)`);
  console.log(`\nWaiting for connections...`);
}

main().catch(console.error);
