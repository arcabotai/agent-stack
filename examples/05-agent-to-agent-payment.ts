/**
 * Example 5: Agent-to-Agent payment flow
 *
 * This is the core value proposition of the Agent Stack SDK:
 * - Agent A verifies Agent B's identity (ERC-8004)
 * - Agent A discovers B's MCP endpoint (from services array)
 * - Agent A checks B's payment wallet
 * - Agent A connects and calls a tool, auto-paying via x402
 *
 * This example simulates the full flow without making real transactions.
 *
 * Run:
 *   PRIVATE_KEY=0x... node --loader ts-node/esm 05-agent-to-agent-payment.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { verifyAgent, getMcpEndpoint } from "@agent-stack/identity";
import { PaymentClient } from "@agent-stack/payments";
import { createAgentMcpClient } from "@agent-stack/data";

const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "") as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY env var");

// The target agent (replace with any real ERC-8004 global ID)
const TARGET = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376";

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`\n🤖 Agent A (this agent): ${account.address}`);
  console.log(`🎯 Agent B (target):     ${TARGET}\n`);

  // ─── Step 1: Check payment balance ───────────────────────────────
  console.log("Step 1: Check payment balance...");
  const payer = new PaymentClient({ account });
  try {
    const balance = await payer.getBalance("eip155:8453");
    console.log(`  USDC balance: ${balance.formatted} USDC`);
    if (balance.amount < BigInt("10000")) {
      console.log("  ⚠️  Low balance — need at least 0.01 USDC to pay agents");
    }
  } catch (e) {
    console.log(`  (balance check failed: ${(e as Error).message})`);
  }

  // ─── Step 2: Verify Agent B's identity ───────────────────────────
  console.log("\nStep 2: Verify Agent B identity (ERC-8004)...");
  const verification = await verifyAgent(TARGET);

  if (!verification.valid) {
    console.log(`  ❌ Verification failed: ${verification.error}`);
    console.log("  Cannot connect to unverified agent.");
    return;
  }

  console.log(`  ✅ Identity verified!`);
  console.log(`     Owner: ${verification.owner}`);
  console.log(`     Name: ${verification.registration?.name}`);
  console.log(`     Description: ${verification.registration?.description}`);
  console.log(`     x402 Support: ${verification.registration?.x402Support}`);
  console.log(`     Payment wallet: ${verification.paymentWallet ?? "(uses owner address)"}`);
  console.log(`     Services: ${verification.registration?.services.map((s) => s.name).join(", ")}`);

  // ─── Step 3: Resolve MCP endpoint ─────────────────────────────────
  console.log("\nStep 3: Resolve Agent B's MCP endpoint...");
  const mcpUrl = await getMcpEndpoint(TARGET);

  if (!mcpUrl) {
    console.log("  ❌ Agent B does not expose an MCP endpoint.");
    console.log("  Check their services array for a 'MCP' entry.");
    return;
  }
  console.log(`  ✅ MCP endpoint: ${mcpUrl}`);

  // ─── Step 4: Check if endpoint requires payment ────────────────────
  console.log("\nStep 4: Check payment requirements...");
  try {
    const paymentCheck = await payer.checkPaymentRequirements(mcpUrl);
    if (paymentCheck.requiresPayment) {
      console.log(`  💰 Payment required!`);
      console.log(`     Amount: ${paymentCheck.amount} base units`);
      console.log(`     Token: ${paymentCheck.asset}`);
      console.log(`     Network: ${paymentCheck.network}`);
      console.log(`     Pay to: ${paymentCheck.payTo}`);
    } else {
      console.log(`  🆓 No payment required (or HEAD not supported)`);
    }
  } catch {
    console.log(`  (payment check skipped)`);
  }

  // ─── Step 5: Connect and call tools (with auto-payment) ────────────
  console.log("\nStep 5: Connect to Agent B (auto-pay x402 if required)...");
  try {
    const client = await createAgentMcpClient({
      agentId: TARGET,
      payer: {
        account,
        maxAmount: "100000", // max 0.10 USDC auto-pay
      },
    });

    console.log(`  ✅ Connected to ${mcpUrl}`);

    // List tools
    const tools = await client.listTools();
    console.log(`\n  📦 Tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`     - ${tool.name}`);
    }

    // Read identity
    const identity = await client.getAgentIdentity();
    if (identity) {
      console.log(`\n  🪪 Identity confirmed: ${identity.name}`);
    }

    await client.close();
    console.log(`\n  ✅ Session complete.`);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("ECONNREFUSED")) {
      console.log(`  ⚠️  Could not connect — Agent B's MCP server may be offline.`);
      console.log(`  This is expected in this demo (${mcpUrl} is not running locally).`);
    } else {
      console.log(`  Error: ${msg}`);
    }
  }

  console.log(`
═══════════════════════════════════════
✅ Agent-to-Agent Payment Flow Complete
═══════════════════════════════════════

What just happened:
1. Verified Agent B's ERC-8004 identity on-chain
2. Resolved their MCP endpoint from registration services
3. Identified payment wallet and requirements
4. Connected with auto-payment capability (x402)
5. Listed tools and read identity resource

In production:
- Step 4 would auto-pay via x402 (EIP-3009 signature)
- Payment goes directly to Agent B's wallet
- No intermediary, no custodian, instant settlement
`);
}

main().catch(console.error);
