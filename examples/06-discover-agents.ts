/**
 * Example 06: Discover agents and check reputation
 *
 * Uses ag0's subgraph to search the ERC-8004 ecosystem,
 * then verifies identity with A3Stack before connecting.
 *
 * No wallet needed — read-only discovery.
 */

import { A3Stack, AgentDiscovery, verifyAgent } from "@a3stack/core";
import { base } from "viem/chains";

async function main() {
  // Option A: Standalone discovery (no wallet needed)
  const discovery = new AgentDiscovery({
    chainId: 8453,
    rpcUrl: process.env.RPC_URL!,
  });

  // Search for agents by name
  const weatherAgents = await discovery.search({ name: "weather" });
  console.log(`Found ${weatherAgents.length} weather agents`);

  // Search for trusted agents (minimum reputation score)
  const trusted = await discovery.search({
    feedback: { minValue: 80 },
    active: true,
  });
  console.log(`Found ${trusted.length} agents with 80+ reputation`);

  // Get reputation for a specific agent
  const rep = await discovery.getReputation("1:22775"); // Arca on mainnet
  console.log(`Arca reputation: ${rep.averageValue}/100 (${rep.count} reviews)`);

  // Get detailed feedback
  const reviews = await discovery.getFeedback("1:22775");
  for (const r of reviews) {
    console.log(`  ${r.value}/100 by ${r.reviewer} — [${r.tags.join(", ")}]`);
  }

  // Option B: Through A3Stack (integrated)
  // const stack = new A3Stack({ account, chain: base, rpc: process.env.RPC_URL });
  // const agents = await stack.discover({ name: "weather" });
  // const rep = await stack.reputation("8453:102");

  // Verify an agent's on-chain identity before trusting
  if (trusted.length > 0) {
    const agent = trusted[0];
    const verification = await verifyAgent({
      chainId: Number(agent.id.split(":")[0]),
      agentId: Number(agent.id.split(":")[1]),
    });

    if (verification.valid) {
      console.log(`\n✅ ${agent.name} is verified on-chain`);
      console.log(`   Owner: ${verification.owner}`);
      console.log(`   Services: ${verification.registration?.services.map(s => s.name).join(", ")}`);
    }
  }
}

main().catch(console.error);
