/**
 * Example 3: Connect to a paid MCP server using agent identity
 *
 * Demonstrates:
 * - Resolving an MCP endpoint from an ERC-8004 global ID
 * - Auto-paying x402 requirements
 * - Verifying agent identity before connecting
 * - Calling tools and reading resources
 *
 * Run:
 *   PRIVATE_KEY=0x... node --loader ts-node/esm 03-mcp-client.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { createAgentMcpClient } from "@a3stack/data";
import { verifyAgent } from "@a3stack/identity";

const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "") as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY env var");

// The agent we want to connect to (example: Arca on Base)
const TARGET_AGENT_ID = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376";

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`My wallet: ${account.address}`);

  // Step 1: Verify agent identity before connecting
  console.log(`\n🔍 Verifying agent identity: ${TARGET_AGENT_ID}`);
  const verification = await verifyAgent(TARGET_AGENT_ID);

  if (!verification.valid) {
    console.error(`❌ Identity verification failed: ${verification.error}`);
    process.exit(1);
  }

  console.log(`✅ Agent verified!`);
  console.log(`   Owner: ${verification.owner}`);
  console.log(`   Name: ${verification.registration?.name}`);
  console.log(`   x402 Support: ${verification.registration?.x402Support}`);
  console.log(
    `   Payment wallet: ${verification.paymentWallet ?? "same as owner"}`
  );

  // Step 2: Connect (auto-resolves MCP endpoint, sets up payment)
  console.log(`\n🔌 Connecting to MCP endpoint...`);
  const client = await createAgentMcpClient({
    agentId: TARGET_AGENT_ID,
    payer: {
      account,
      maxAmount: "100000", // max 0.10 USDC auto-pay per session
    },
  });

  // Step 3: List available tools
  const tools = await client.listTools();
  console.log(`\n📦 Available tools (${tools.length}):`);
  for (const tool of tools) {
    console.log(`   - ${tool.name}: ${tool.description ?? "(no description)"}`);
  }

  // Step 4: Read agent identity resource
  console.log(`\n🪪 Agent identity resource:`);
  const identity = await client.getAgentIdentity();
  if (identity) {
    console.log(`   Name: ${identity.name}`);
    console.log(`   Description: ${identity.description}`);
    console.log(`   Services: ${(identity.services as Array<{name: string}>)?.map((s) => s.name).join(", ")}`);
  }

  // Step 5: Call ping (free)
  console.log(`\n📡 Calling ping (free tool)...`);
  const pingResult = await client.callTool("ping");
  const pingData = JSON.parse((pingResult.content[0] as { text: string }).text);
  console.log(`   Status: ${pingData.status}`);
  console.log(`   Requires payment: ${pingData.requiresPayment}`);

  // Step 6: Call a paid tool (auto-pays x402)
  console.log(`\n💰 Calling get-price (paid tool — auto-paying x402)...`);
  const priceResult = await client.callTool("get-price", { symbol: "ETH" });
  const priceData = JSON.parse((priceResult.content[0] as { text: string }).text);
  console.log(`   ETH price: $${priceData.price}`);
  console.log(`   Payment handled automatically ✅`);

  // Close connection
  await client.close();
  console.log(`\n✅ Done!`);
}

main().catch(console.error);
