/**
 * Integration test — verify Arca's agent identity on Base
 * Run: npx tsx test/verify-arca.ts
 * 
 * This is a read-only test: no wallet needed, no transactions.
 */

import { verifyAgent, getMcpEndpoint, getAgentCount, parseAgentId } from "@agent-stack/identity";

const ARCA_BASE = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376";
const ARCA_ETH = "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#22775";
const ARCA_WALLET = "0x1be93C700dDC596D701E8F2106B8F9166C625Adb";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

async function main() {
  console.log("\n🧪 Agent Stack SDK — Integration Tests\n");

  // 1. Parse global ID
  console.log("1. Parse agent global ID");
  const ref = parseAgentId(ARCA_BASE);
  assert(ref.namespace === "eip155", "namespace = eip155");
  assert(ref.chainId === 8453, "chainId = 8453");
  assert(ref.agentId === 2376, "agentId = 2376");
  assert(ref.registry === "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", "registry address correct");

  // 2. Verify Arca on Base
  console.log("\n2. Verify Arca on Base (on-chain)");
  const baseResult = await verifyAgent(ARCA_BASE);
  assert(baseResult.owner !== null, `owner found: ${baseResult.owner}`);
  assert(
    baseResult.owner?.toLowerCase() === ARCA_WALLET.toLowerCase(),
    `owner matches our wallet`
  );
  assert(baseResult.registration !== null, "registration file fetched");
  if (baseResult.registration) {
    assert(baseResult.registration.name !== undefined, `name: ${baseResult.registration.name}`);
    assert(baseResult.registration.active === true, "agent is active");
    assert(Array.isArray(baseResult.registration.services), "has services array");
  }
  console.log(`   valid: ${baseResult.valid}${baseResult.error ? `, error: ${baseResult.error}` : ""}`);

  // 3. Verify Arca on Ethereum
  console.log("\n3. Verify Arca on Ethereum (on-chain)");
  const ethResult = await verifyAgent(ARCA_ETH);
  assert(ethResult.owner !== null, `owner found: ${ethResult.owner}`);
  assert(
    ethResult.owner?.toLowerCase() === ARCA_WALLET.toLowerCase(),
    `owner matches our wallet`
  );
  console.log(`   valid: ${ethResult.valid}${ethResult.error ? `, error: ${ethResult.error}` : ""}`);

  // 4. Agent count
  console.log("\n4. Check agent count on Base");
  const count = await getAgentCount(ARCA_WALLET as `0x${string}`, 8453);
  assert(count >= 1, `agent count on Base: ${count}`);

  // 5. MCP endpoint resolution
  console.log("\n5. Resolve MCP endpoint");
  const mcpUrl = await getMcpEndpoint(ARCA_BASE);
  console.log(`   MCP endpoint: ${mcpUrl ?? "(none)"}`);
  // This might be null if we haven't set up an MCP service yet — that's ok

  // 6. Payment wallet
  console.log("\n6. Payment wallet");
  console.log(`   Payment wallet: ${baseResult.paymentWallet ?? "(not set — defaults to owner)"}`);

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
