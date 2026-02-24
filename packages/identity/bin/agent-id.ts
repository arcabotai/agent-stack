#!/usr/bin/env node
/**
 * agent-id CLI — verify and inspect ERC-8004 agent identities
 * 
 * Usage:
 *   npx @a3stack/identity verify <globalId>
 *   npx @a3stack/identity lookup <walletAddress>
 *   npx @a3stack/identity chains
 */

import { verifyAgent, getMcpEndpoint, getAgentCount, parseAgentId, SUPPORTED_CHAINS } from "../src/index.js";
import { findAllRegistrations } from "../src/multichain.js";

const [cmd, ...args] = process.argv.slice(2);

const HELP = `
🆔 agent-id — ERC-8004 Agent Identity CLI

Commands:
  verify <globalId>       Verify an agent's on-chain identity
  lookup <wallet>         Find all registrations for a wallet address
  chains                  List supported chains

Examples:
  npx @a3stack/identity verify "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#2376"
  npx @a3stack/identity lookup 0xYOUR_WALLET_ADDRESS
  npx @a3stack/identity chains
`;

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }

  if (cmd === "verify") {
    const globalId = args[0];
    if (!globalId) {
      console.error("Usage: agent-id verify <globalId>");
      process.exit(1);
    }

    console.log(`\n🔍 Verifying: ${globalId}\n`);

    const ref = parseAgentId(globalId);
    console.log(`   Chain:    ${ref.chainId}`);
    console.log(`   Registry: ${ref.registry}`);
    console.log(`   Agent ID: ${ref.agentId}`);

    const result = await verifyAgent(globalId);

    if (!result.valid) {
      console.log(`\n   ❌ FAILED: ${result.error}\n`);
      process.exit(1);
    }

    console.log(`\n   ✅ Verified!`);
    console.log(`   Owner:          ${result.owner}`);
    console.log(`   Payment wallet: ${result.paymentWallet ?? "(defaults to owner)"}`);

    if (result.registration) {
      console.log(`   Name:           ${result.registration.name}`);
      console.log(`   Active:         ${result.registration.active}`);
      console.log(`   x402 Payments:  ${result.registration.x402Support}`);

      if (result.registration.services?.length) {
        console.log(`\n   Services:`);
        for (const s of result.registration.services) {
          console.log(`   - ${s.name}: ${s.endpoint}`);
        }
      }
    }
    console.log();

  } else if (cmd === "lookup") {
    const wallet = args[0] as `0x${string}`;
    if (!wallet?.startsWith("0x")) {
      console.error("Usage: agent-id lookup <0xWalletAddress>");
      process.exit(1);
    }

    console.log(`\n🌐 Scanning all chains for ${wallet}...\n`);
    const regs = await findAllRegistrations(wallet, { timeoutMs: 15000 });

    if (regs.length === 0) {
      console.log("   No registrations found.\n");
      return;
    }

    console.log(`   Found ${regs.length} registration(s):\n`);
    for (const r of regs) {
      console.log(`   ✅ ${r.chainName.padEnd(12)} #${String(r.agentId).padEnd(6)}  ${r.globalId}`);
    }
    console.log();

  } else if (cmd === "chains") {
    console.log("\n🌐 Supported ERC-8004 chains:\n");
    for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
      console.log(`   ${chain.name.padEnd(15)} chain ${id}`);
    }
    console.log(`\n   Total: ${Object.keys(SUPPORTED_CHAINS).length} chains\n`);

  } else {
    console.error(`Unknown command: ${cmd}`);
    console.log(HELP);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
