/**
 * Example 4: Full Agent Stack — identity + payments + MCP in one
 *
 * Demonstrates the AgentStack class, which combines all three layers.
 * This is the "zero config" path for building a complete agent service.
 *
 * Run:
 *   PRIVATE_KEY=0x... node --loader ts-node/esm 04-full-agent-stack.ts
 */

import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { AgentStack } from "@agent-stack/core";
import { USDC_BASE } from "@agent-stack/payments";

const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "") as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY env var");

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`\n🤖 Agent Stack Demo`);
  console.log(`   Wallet: ${account.address}`);

  // ─── Initialize AgentStack ────────────────────────────────────────
  const agent = new AgentStack({
    account,
    chain: base,
    rpc: "https://mainnet.base.org",

    server: {
      name: "DemoAgent",
      version: "1.0.0",
      port: 3001,

      // Require 0.001 USDC per tool call
      payment: {
        amount: "1000",
        asset: USDC_BASE,
        network: "eip155:8453",
        description: "DemoAgent: 0.001 USDC per call",
        // payTo defaults to this agent's wallet address
      },
    },
  });

  // ─── Register tools ───────────────────────────────────────────────
  agent.tool(
    "hello",
    "Say hello with a personalized message",
    { name: z.string().optional() },
    async ({ name }) => ({
      content: [
        {
          type: "text" as const,
          text: `Hello, ${name ?? "world"}! I'm DemoAgent — a paid AI service built on the Agent Stack SDK.`,
        },
      ],
    })
  );

  agent.tool(
    "calculate",
    "Perform a simple calculation",
    {
      expression: z.string().describe('Math expression, e.g. "2 + 2"'),
    },
    async ({ expression }) => {
      // In production: use a proper math parser, not eval
      let result: number;
      try {
        // eslint-disable-next-line no-eval
        result = Function(`"use strict"; return (${expression})`)() as number;
      } catch {
        result = NaN;
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ expression, result }),
          },
        ],
      };
    }
  );

  // ─── Start server ─────────────────────────────────────────────────
  const { url } = await agent.start();
  console.log(`\n✅ DemoAgent MCP server running at ${url}`);

  // ─── Check USDC balance ───────────────────────────────────────────
  try {
    const balance = await agent.getBalance();
    console.log(`   USDC balance: ${balance.formatted} ${balance.symbol}`);
  } catch {
    console.log(`   (balance check skipped — no RPC data)`);
  }

  // ─── Connect to another agent ─────────────────────────────────────
  // Example: connect to Arca (our own registered agent) for demonstration
  const ARCA_GLOBAL_ID = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376";

  console.log(`\n🔍 Verifying Arca agent identity...`);
  const verification = await agent.verify(ARCA_GLOBAL_ID);
  if (verification.valid) {
    console.log(`   ✅ Arca verified — owner: ${verification.owner}`);
    console.log(
      `   Name: ${verification.registration?.name}, x402: ${verification.registration?.x402Support}`
    );

    const mcpUrl = await agent.getMcpEndpoint(ARCA_GLOBAL_ID);
    if (mcpUrl) {
      console.log(`   MCP endpoint: ${mcpUrl}`);
    }
  } else {
    console.log(`   ⚠️  Verification: ${verification.error}`);
  }

  // ─── (Optional) Register on-chain ────────────────────────────────
  // Uncomment to actually register (costs gas):
  //
  // console.log("\n📝 Registering on Base...");
  // const { agentId, globalId } = await agent.register({
  //   name: "DemoAgent",
  //   description: "Demo agent built with Agent Stack SDK",
  //   x402Support: true,
  //   active: true,
  //   includeServerEndpoint: true,
  //   mcpUrl: url,
  // });
  // console.log(`   Agent ID: #${agentId}`);
  // console.log(`   Global ID: ${globalId}`);

  console.log(`\n✅ Agent Stack running. Press Ctrl+C to stop.`);
}

main().catch(console.error);
