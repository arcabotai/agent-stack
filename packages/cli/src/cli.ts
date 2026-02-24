#!/usr/bin/env node
/**
 * a3stack CLI — identity, payments, and data for AI agents
 *
 * Usage:
 *   npx a3stack verify <globalId>       Verify an agent's on-chain identity
 *   npx a3stack lookup <wallet>         Find all chain registrations for a wallet
 *   npx a3stack probe <globalId>        Discover an agent's capabilities
 *   npx a3stack chains                  List supported ERC-8004 chains
 *   npx a3stack count [chainId]         Count registered agents on a chain
 *   npx a3stack init                    Scaffold a new A3Stack agent project
 */

import { createPublicClient, http, getAddress, type Hex } from "viem";
import * as chains from "viem/chains";

// ─── Constants (inlined to avoid workspace dep issues with npx) ──────────────

const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const REGISTRY_ABI = [
  { inputs: [{ name: "agentId", type: "uint256" }], name: "ownerOf", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "agentId", type: "uint256" }], name: "tokenURI", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const TRANSFER_EVENT = {
  type: "event" as const,
  name: "Transfer" as const,
  inputs: [
    { type: "address" as const, indexed: true, name: "from" as const },
    { type: "address" as const, indexed: true, name: "to" as const },
    { type: "uint256" as const, indexed: true, name: "tokenId" as const },
  ],
};

const SUPPORTED_CHAINS: Record<number, { name: string; rpc: string }> = {
  1: { name: "Ethereum", rpc: "https://eth.llamarpc.com" },
  10: { name: "Optimism", rpc: "https://mainnet.optimism.io" },
  56: { name: "BNB Chain", rpc: "https://bsc-dataseed.binance.org" },
  100: { name: "Gnosis", rpc: "https://rpc.gnosischain.com" },
  130: { name: "Unichain", rpc: "https://mainnet.unichain.org" },
  137: { name: "Polygon", rpc: "https://polygon-rpc.com" },
  196: { name: "X Layer", rpc: "https://rpc.xlayer.tech" },
  480: { name: "World Chain", rpc: "https://worldchain-mainnet.g.alchemy.com/public" },
  690: { name: "Redstone", rpc: "https://rpc.redstonechain.com" },
  8453: { name: "Base", rpc: "https://mainnet.base.org" },
  42161: { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
  42170: { name: "Arbitrum Nova", rpc: "https://nova.arbitrum.io/rpc" },
  43114: { name: "Avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc" },
  57073: { name: "Ink", rpc: "https://rpc-gel.inkonchain.com" },
  81457: { name: "Blast", rpc: "https://rpc.blast.io" },
  534352: { name: "Scroll", rpc: "https://rpc.scroll.io" },
  7777777: { name: "Zora", rpc: "https://rpc.zora.energy" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseGlobalId(id: string) {
  // eip155:<chainId>:<registry>#<agentId>
  const match = id.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})#(\d+)$/);
  if (!match) throw new Error(`Invalid global ID format: ${id}\nExpected: eip155:<chainId>:<registry>#<agentId>`);
  return { chainId: Number(match[1]), registry: match[2] as Hex, agentId: BigInt(match[3]) };
}

function getClient(chainId: number) {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}. Run 'a3stack chains' to see supported chains.`);
  return createPublicClient({ transport: http(chain.rpc) });
}

function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }

// ─── Commands ────────────────────────────────────────────────────────────────

async function verify(globalId: string) {
  console.log(`\n${bold("🔍 Verifying agent identity")}\n`);

  const ref = parseGlobalId(globalId);
  const chainName = SUPPORTED_CHAINS[ref.chainId]?.name ?? `Chain ${ref.chainId}`;

  console.log(`   Chain:    ${cyan(chainName)} (${ref.chainId})`);
  console.log(`   Registry: ${dim(ref.registry)}`);
  console.log(`   Agent ID: ${bold("#" + ref.agentId.toString())}\n`);

  const client = getClient(ref.chainId);

  // Check owner
  let owner: string;
  try {
    owner = await client.readContract({
      address: ref.registry as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "ownerOf",
      args: [ref.agentId],
    }) as string;
  } catch (e) {
    console.log(`   ${red("✗")} Agent not found or reverted\n`);
    process.exit(1);
  }

  console.log(`   ${green("✓")} ${bold("Verified on-chain")}`);
  console.log(`   Owner: ${owner}`);

  // Fetch tokenURI
  try {
    const uri = await client.readContract({
      address: ref.registry as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "tokenURI",
      args: [ref.agentId],
    }) as string;

    if (uri.startsWith("data:application/json")) {
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
      if (json.name) console.log(`   Name:  ${bold(json.name)}`);
      if (json.description) console.log(`   Desc:  ${json.description}`);
    } else if (uri.startsWith("ipfs://") || uri.startsWith("http")) {
      console.log(`   URI:   ${dim(uri)}`);
      try {
        const fetchUrl = uri.startsWith("ipfs://")
          ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
          : uri;
        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const json = await res.json();
          if (json.name) console.log(`   Name:  ${bold(json.name)}`);
          if (json.description) console.log(`   Desc:  ${json.description}`);
          if (json.services?.length) {
            console.log(`\n   ${bold("Services:")}`);
            for (const s of json.services) {
              console.log(`   ${cyan("→")} ${s.name}: ${s.endpoint}`);
            }
          }
        }
      } catch { /* metadata fetch failed, not critical */ }
    }
  } catch { /* no tokenURI */ }

  console.log();
}

async function lookup(wallet: string) {
  const addr = getAddress(wallet);
  console.log(`\n${bold("🌐 Scanning all chains")} for ${dim(addr)}\n`);

  const results: Array<{ chain: string; chainId: number; agentId: bigint; globalId: string }> = [];
  const promises = Object.entries(SUPPORTED_CHAINS).map(async ([id, chain]) => {
    const chainId = Number(id);
    try {
      const client = createPublicClient({ transport: http(chain.rpc) });

      // Check balance first (fast)
      const balance = await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "balanceOf",
        args: [addr as `0x${string}`],
      }) as bigint;

      if (balance === 0n) return;

      // Find agent IDs via Transfer events (mint from 0x0)
      const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: TRANSFER_EVENT,
        args: {
          from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          to: addr as `0x${string}`,
        },
        fromBlock: 0n,
        toBlock: "latest",
      });

      for (const log of logs) {
        const agentId = (log as any).args.tokenId as bigint;
        results.push({
          chain: chain.name,
          chainId,
          agentId,
          globalId: `eip155:${chainId}:${REGISTRY_ADDRESS}#${agentId}`,
        });
      }
    } catch { /* chain not reachable or no registration */ }
  });

  await Promise.allSettled(promises);

  if (results.length === 0) {
    console.log(`   No registrations found.\n`);
    return;
  }

  results.sort((a, b) => a.chainId - b.chainId);
  console.log(`   Found ${green(results.length.toString())} registration(s):\n`);

  for (const r of results) {
    console.log(`   ${green("✓")} ${r.chain.padEnd(15)} ${yellow("#" + r.agentId.toString().padEnd(6))} ${dim(r.globalId)}`);
  }
  console.log();
}

async function probe(globalId: string) {
  console.log(`\n${bold("🔬 Probing agent")} ${dim(globalId)}\n`);

  const ref = parseGlobalId(globalId);
  const chainName = SUPPORTED_CHAINS[ref.chainId]?.name ?? `Chain ${ref.chainId}`;
  const client = getClient(ref.chainId);

  // Verify
  let owner: string;
  try {
    owner = await client.readContract({
      address: ref.registry as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "ownerOf",
      args: [ref.agentId],
    }) as string;
  } catch {
    console.log(`   ${red("✗")} Agent not found\n`);
    process.exit(1);
  }

  console.log(`   ${green("✓")} Identity verified on ${cyan(chainName)}`);
  console.log(`   Owner: ${dim(owner)}`);

  // Fetch metadata
  try {
    const uri = await client.readContract({
      address: ref.registry as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "tokenURI",
      args: [ref.agentId],
    }) as string;

    let metadata: any = null;
    if (uri.startsWith("data:application/json")) {
      metadata = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    } else if (uri.startsWith("ipfs://") || uri.startsWith("http")) {
      const fetchUrl = uri.startsWith("ipfs://")
        ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
        : uri;
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) metadata = await res.json();
    }

    if (metadata) {
      console.log(`   Name:   ${bold(metadata.name ?? "unnamed")}`);
      if (metadata.description) console.log(`   Desc:   ${metadata.description}`);
      if (metadata.active !== undefined) console.log(`   Active: ${metadata.active ? green("yes") : red("no")}`);
      if (metadata.x402Support) console.log(`   x402:   ${green("accepts payments")}`);
      if (metadata.paymentWallet) console.log(`   Pay to: ${dim(metadata.paymentWallet)}`);

      if (metadata.services?.length) {
        console.log(`\n   ${bold("Endpoints:")}`);
        for (const s of metadata.services) {
          console.log(`   ${cyan("→")} ${s.name.padEnd(8)} ${s.endpoint}`);

          // Try probing MCP for x402 requirements
          if (s.name.toUpperCase() === "MCP" && metadata.x402Support) {
            try {
              const r = await fetch(s.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
                signal: AbortSignal.timeout(5000),
              });
              if (r.status === 402) {
                console.log(`     ${yellow("$")} Payment required (HTTP 402)`);
                const header = r.headers.get("x-payment-required");
                if (header) {
                  try {
                    const decoded = JSON.parse(Buffer.from(header, "base64").toString());
                    const first = Array.isArray(decoded.accepts) ? decoded.accepts[0] : decoded;
                    if (first.maxAmountRequired) console.log(`     ${yellow("$")} Amount: ${first.maxAmountRequired} (${first.network ?? "unknown"})`);
                  } catch { }
                }
              } else if (r.ok) {
                console.log(`     ${green("✓")} Endpoint reachable (free)`);
              }
            } catch {
              console.log(`     ${dim("⚠ Endpoint not reachable")}`);
            }
          }
        }
      }

      // Cross-chain registrations
      if (metadata.registrations?.length) {
        console.log(`\n   ${bold("Cross-chain IDs:")}`);
        for (const reg of metadata.registrations) {
          console.log(`   ${dim("•")} Agent #${reg.agentId} @ ${dim(reg.agentRegistry)}`);
        }
      }
    }
  } catch { /* metadata fetch failed */ }

  console.log();
}

async function showChains() {
  console.log(`\n${bold("🌐 Supported ERC-8004 chains")}\n`);
  console.log(`   ${dim("Chain".padEnd(16))} ${dim("ID".padEnd(10))} ${dim("Registry")}\n`);

  for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
    console.log(`   ${chain.name.padEnd(16)} ${id.padEnd(10)} ${dim(REGISTRY_ADDRESS)}`);
  }
  console.log(`\n   ${bold(Object.keys(SUPPORTED_CHAINS).length.toString())} chains — same registry address on all.\n`);
}

async function count(chainIdStr?: string) {
  const chainIds = chainIdStr
    ? [Number(chainIdStr)]
    : Object.keys(SUPPORTED_CHAINS).map(Number);

  console.log(`\n${bold("📊 Agent count")} ${dim("(scanning Transfer events)")}\n`);

  const promises = chainIds.map(async (chainId) => {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) return { chainId, name: `Unknown (${chainId})`, count: -1 };
    try {
      const client = createPublicClient({ transport: http(chain.rpc) });
      // Count mint events (Transfer from 0x0)
      const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: "0x0000000000000000000000000000000000000000" as `0x${string}` },
        fromBlock: 0n,
        toBlock: "latest",
      });
      return { chainId, name: chain.name, count: logs.length };
    } catch {
      return { chainId, name: chain.name, count: -1 };
    }
  });

  const results = await Promise.all(promises);
  results.sort((a, b) => b.count - a.count);

  for (const r of results) {
    if (r.count >= 0) {
      console.log(`   ${r.name.padEnd(16)} ${yellow(r.count.toString().padStart(6))} agents`);
    } else {
      console.log(`   ${r.name.padEnd(16)} ${dim("  error")}`);
    }
  }
  console.log();
}

function scaffoldInit() {
  console.log(`\n${bold("🚀 Scaffold a new A3Stack agent")}\n`);
  console.log(`${dim("Coming in v0.2.0 — for now, install the packages directly:")}\n`);
  console.log(`   ${cyan("npm install @a3stack/core viem")}\n`);
  console.log(`   Then in your code:\n`);
  console.log(`   ${dim('import { A3Stack } from "@a3stack/core";')}`);
  console.log(`   ${dim('')}`);
  console.log(`   ${dim('const agent = new A3Stack({')}`);
  console.log(`   ${dim('  privateKey: process.env.PRIVATE_KEY,')}`);
  console.log(`   ${dim('  chainId: 8453,  // Base')}`);
  console.log(`   ${dim('});')}`);
  console.log(`   ${dim('')}`);
  console.log(`   ${dim('await agent.register({ name: "my-agent" });')}`);
  console.log(`   ${dim('console.log("Registered:", agent.globalId);')}\n`);
  console.log(`   Docs: ${cyan("https://a3stack.arcabot.ai")}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const HELP = `
${bold("a3stack")} — identity, payments, and data for AI agents

${bold("Commands:")}
  ${cyan("verify")} <globalId>       Verify an agent's on-chain identity
  ${cyan("lookup")} <wallet>         Find all chain registrations for a wallet
  ${cyan("probe")}  <globalId>       Discover an agent's capabilities & endpoints
  ${cyan("chains")}                  List supported ERC-8004 chains
  ${cyan("count")}  [chainId]        Count registered agents (all chains or one)
  ${cyan("init")}                    Scaffold a new agent project

${bold("Examples:")}
  npx a3stack verify "eip155:8453:${REGISTRY_ADDRESS}#2376"
  npx a3stack lookup 0xYOUR_WALLET_ADDRESS
  npx a3stack probe "eip155:8453:${REGISTRY_ADDRESS}#2376"
  npx a3stack count 8453

${dim(`v0.1.0 • https://a3stack.arcabot.ai • github.com/arcabotai/a3stack`)}
`;

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(HELP);
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    console.log("a3stack v0.1.0");
    return;
  }

  switch (cmd) {
    case "verify": return verify(args[0]);
    case "lookup": return lookup(args[0]);
    case "probe": return probe(args[0]);
    case "chains": return showChains();
    case "count": return count(args[0]);
    case "init": return scaffoldInit();
    default:
      console.error(`${red("Unknown command:")} ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${red("Error:")} ${err.message}`);
  process.exit(1);
});
