import { findAllRegistrations } from "@a3stack/identity";

const WALLET = process.env.TEST_WALLET as `0x${string}`;
if (!WALLET) throw new Error("Set TEST_WALLET env var");

async function main() {
  console.log("\n🌐 Scanning all 16 chains for registrations...\n");
  const regs = await findAllRegistrations(WALLET);
  console.log(`Found ${regs.length} registrations:\n`);
  for (const r of regs) {
    console.log(`  ✅ ${r.chainName.padEnd(12)} (chain ${String(r.chainId).padEnd(6)}) → #${r.agentId}  ${r.globalId}`);
  }
  console.log();
}

main().catch(console.error);
