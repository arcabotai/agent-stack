/**
 * Example 1: Register an AI agent on-chain via ERC-8004
 *
 * This creates an on-chain identity for your agent:
 * - Mints an ERC-721 token representing the agent
 * - Stores registration metadata (name, services, MCP endpoint, etc.)
 * - Returns a global agent ID like "eip155:8453:0x8004...#2376"
 *
 * Run:
 *   PRIVATE_KEY=0x... node --loader ts-node/esm 01-register-agent.ts
 */

import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { AgentIdentity } from "@a3stack/identity";

const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "") as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY env var");

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Wallet: ${account.address}`);

  const identity = new AgentIdentity({
    account,
    chain: base,
    rpc: "https://mainnet.base.org",
  });

  // Check if already registered
  const { registered } = await identity.isRegistered();
  if (registered) {
    console.log("Already registered on Base! Use setAgentURI() to update.");
    return;
  }

  console.log("Registering on Base...");

  const result = await identity.register({
    name: "MyAgent",
    description: "An AI agent built with A3Stack SDK. Provides market data and analysis.",
    image: "https://example.com/agent-logo.png",
    services: [
      {
        name: "MCP",
        endpoint: "https://mcp.myagent.example/mcp",
        version: "2025-06-18",
      },
      {
        name: "web",
        endpoint: "https://myagent.example",
      },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
  });

  console.log(`✅ Registered!`);
  console.log(`  Agent ID: #${result.agentId}`);
  console.log(`  Global ID: ${result.globalId}`);
  console.log(`  Tx: https://basescan.org/tx/${result.txHash}`);
  console.log(`\nShare your Global ID for others to discover you:`);
  console.log(`  ${result.globalId}`);
}

main().catch(console.error);
