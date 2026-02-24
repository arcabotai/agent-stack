/**
 * Example 00: Verify any agent's identity (read-only, no wallet needed)
 * 
 * Usage: npx tsx examples/00-verify-identity.ts [globalId]
 * 
 * Default: verifies Arca (arcabot.eth) on Base
 */

import { verifyAgent, getMcpEndpoint, getA2aEndpoint, parseAgentId } from "@a3stack/identity";

const DEFAULT_AGENT = "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376";

async function main() {
  const globalId = process.argv[2] || DEFAULT_AGENT;

  console.log("\n🔍 A3Stack — Identity Verifier\n");
  console.log(`   Agent ID: ${globalId}\n`);

  // Parse the ID
  const ref = parseAgentId(globalId);
  console.log(`   Chain:    ${ref.chainId} (${ref.namespace})`);
  console.log(`   Registry: ${ref.registry}`);
  console.log(`   Token ID: ${ref.agentId}`);

  // Verify on-chain
  console.log("\n📡 Querying on-chain...\n");
  const result = await verifyAgent(globalId);

  if (!result.valid) {
    console.log(`   ❌ Verification FAILED: ${result.error}`);
    process.exit(1);
  }

  console.log(`   ✅ Identity verified!`);
  console.log(`   Owner:          ${result.owner}`);
  console.log(`   Payment wallet: ${result.paymentWallet ?? "(defaults to owner)"}`);

  if (result.registration) {
    const reg = result.registration;
    console.log(`\n   📋 Registration File:`);
    console.log(`   Name:        ${reg.name}`);
    console.log(`   Description: ${reg.description}`);
    console.log(`   Active:      ${reg.active}`);
    console.log(`   x402 Pay:    ${reg.x402Support}`);

    if (reg.services?.length) {
      console.log(`\n   🔌 Services:`);
      for (const svc of reg.services) {
        console.log(`   - ${svc.name}: ${svc.endpoint}${svc.version ? ` (v${svc.version})` : ""}`);
      }
    }

    if (reg.registrations?.length) {
      console.log(`\n   🌐 Cross-chain registrations:`);
      for (const r of reg.registrations) {
        console.log(`   - ${r.agentRegistry}#${r.agentId}`);
      }
    }
  }

  // Resolve endpoints
  const mcpUrl = await getMcpEndpoint(globalId);
  const a2aUrl = await getA2aEndpoint(globalId);
  console.log(`\n   🔗 Endpoints:`);
  console.log(`   MCP: ${mcpUrl ?? "(not configured)"}`);
  console.log(`   A2A: ${a2aUrl ?? "(not configured)"}`);

  console.log("\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
