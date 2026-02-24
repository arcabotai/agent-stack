#!/usr/bin/env node

// src/cli.ts
import { createPublicClient, http, getAddress } from "viem";
var REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
var REGISTRY_ABI = [
  { inputs: [{ name: "agentId", type: "uint256" }], name: "ownerOf", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "agentId", type: "uint256" }], name: "tokenURI", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }
];
var TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { type: "address", indexed: true, name: "from" },
    { type: "address", indexed: true, name: "to" },
    { type: "uint256", indexed: true, name: "tokenId" }
  ]
};
var SUPPORTED_CHAINS = {
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
  7777777: { name: "Zora", rpc: "https://rpc.zora.energy" }
};
function parseGlobalId(id) {
  const match = id.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})#(\d+)$/);
  if (!match) throw new Error(`Invalid global ID format: ${id}
Expected: eip155:<chainId>:<registry>#<agentId>`);
  return { chainId: Number(match[1]), registry: match[2], agentId: BigInt(match[3]) };
}
function getClient(chainId) {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}. Run 'a3stack chains' to see supported chains.`);
  return createPublicClient({ transport: http(chain.rpc) });
}
function bold(s) {
  return `\x1B[1m${s}\x1B[0m`;
}
function green(s) {
  return `\x1B[32m${s}\x1B[0m`;
}
function red(s) {
  return `\x1B[31m${s}\x1B[0m`;
}
function dim(s) {
  return `\x1B[2m${s}\x1B[0m`;
}
function cyan(s) {
  return `\x1B[36m${s}\x1B[0m`;
}
function yellow(s) {
  return `\x1B[33m${s}\x1B[0m`;
}
async function verify(globalId) {
  console.log(`
${bold("\u{1F50D} Verifying agent identity")}
`);
  const ref = parseGlobalId(globalId);
  const chainName = SUPPORTED_CHAINS[ref.chainId]?.name ?? `Chain ${ref.chainId}`;
  console.log(`   Chain:    ${cyan(chainName)} (${ref.chainId})`);
  console.log(`   Registry: ${dim(ref.registry)}`);
  console.log(`   Agent ID: ${bold("#" + ref.agentId.toString())}
`);
  const client = getClient(ref.chainId);
  let owner;
  try {
    owner = await client.readContract({
      address: ref.registry,
      abi: REGISTRY_ABI,
      functionName: "ownerOf",
      args: [ref.agentId]
    });
  } catch (e) {
    console.log(`   ${red("\u2717")} Agent not found or reverted
`);
    process.exit(1);
  }
  console.log(`   ${green("\u2713")} ${bold("Verified on-chain")}`);
  console.log(`   Owner: ${owner}`);
  try {
    const uri = await client.readContract({
      address: ref.registry,
      abi: REGISTRY_ABI,
      functionName: "tokenURI",
      args: [ref.agentId]
    });
    if (uri.startsWith("data:application/json")) {
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
      if (json.name) console.log(`   Name:  ${bold(json.name)}`);
      if (json.description) console.log(`   Desc:  ${json.description}`);
    } else if (uri.startsWith("ipfs://") || uri.startsWith("http")) {
      console.log(`   URI:   ${dim(uri)}`);
      try {
        const fetchUrl = uri.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(5e3) });
        if (res.ok) {
          const json = await res.json();
          if (json.name) console.log(`   Name:  ${bold(json.name)}`);
          if (json.description) console.log(`   Desc:  ${json.description}`);
          if (json.services?.length) {
            console.log(`
   ${bold("Services:")}`);
            for (const s of json.services) {
              console.log(`   ${cyan("\u2192")} ${s.name}: ${s.endpoint}`);
            }
          }
        }
      } catch {
      }
    }
  } catch {
  }
  console.log();
}
async function lookup(wallet) {
  const addr = getAddress(wallet);
  console.log(`
${bold("\u{1F310} Scanning all chains")} for ${dim(addr)}
`);
  const results = [];
  const promises = Object.entries(SUPPORTED_CHAINS).map(async ([id, chain]) => {
    const chainId = Number(id);
    try {
      const client = createPublicClient({ transport: http(chain.rpc) });
      const balance = await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "balanceOf",
        args: [addr]
      });
      if (balance === 0n) return;
      const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: TRANSFER_EVENT,
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: addr
        },
        fromBlock: 0n,
        toBlock: "latest"
      });
      for (const log of logs) {
        const agentId = log.args.tokenId;
        results.push({
          chain: chain.name,
          chainId,
          agentId,
          globalId: `eip155:${chainId}:${REGISTRY_ADDRESS}#${agentId}`
        });
      }
    } catch {
    }
  });
  await Promise.allSettled(promises);
  if (results.length === 0) {
    console.log(`   No registrations found.
`);
    return;
  }
  results.sort((a, b) => a.chainId - b.chainId);
  console.log(`   Found ${green(results.length.toString())} registration(s):
`);
  for (const r of results) {
    console.log(`   ${green("\u2713")} ${r.chain.padEnd(15)} ${yellow("#" + r.agentId.toString().padEnd(6))} ${dim(r.globalId)}`);
  }
  console.log();
}
async function probe(globalId) {
  console.log(`
${bold("\u{1F52C} Probing agent")} ${dim(globalId)}
`);
  const ref = parseGlobalId(globalId);
  const chainName = SUPPORTED_CHAINS[ref.chainId]?.name ?? `Chain ${ref.chainId}`;
  const client = getClient(ref.chainId);
  let owner;
  try {
    owner = await client.readContract({
      address: ref.registry,
      abi: REGISTRY_ABI,
      functionName: "ownerOf",
      args: [ref.agentId]
    });
  } catch {
    console.log(`   ${red("\u2717")} Agent not found
`);
    process.exit(1);
  }
  console.log(`   ${green("\u2713")} Identity verified on ${cyan(chainName)}`);
  console.log(`   Owner: ${dim(owner)}`);
  try {
    const uri = await client.readContract({
      address: ref.registry,
      abi: REGISTRY_ABI,
      functionName: "tokenURI",
      args: [ref.agentId]
    });
    let metadata = null;
    if (uri.startsWith("data:application/json")) {
      metadata = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    } else if (uri.startsWith("ipfs://") || uri.startsWith("http")) {
      const fetchUrl = uri.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8e3) });
      if (res.ok) metadata = await res.json();
    }
    if (metadata) {
      console.log(`   Name:   ${bold(metadata.name ?? "unnamed")}`);
      if (metadata.description) console.log(`   Desc:   ${metadata.description}`);
      if (metadata.active !== void 0) console.log(`   Active: ${metadata.active ? green("yes") : red("no")}`);
      if (metadata.x402Support) console.log(`   x402:   ${green("accepts payments")}`);
      if (metadata.paymentWallet) console.log(`   Pay to: ${dim(metadata.paymentWallet)}`);
      if (metadata.services?.length) {
        console.log(`
   ${bold("Endpoints:")}`);
        for (const s of metadata.services) {
          console.log(`   ${cyan("\u2192")} ${s.name.padEnd(8)} ${s.endpoint}`);
          if (s.name.toUpperCase() === "MCP" && metadata.x402Support) {
            try {
              const r = await fetch(s.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
                signal: AbortSignal.timeout(5e3)
              });
              if (r.status === 402) {
                console.log(`     ${yellow("$")} Payment required (HTTP 402)`);
                const header = r.headers.get("x-payment-required");
                if (header) {
                  try {
                    const decoded = JSON.parse(Buffer.from(header, "base64").toString());
                    const first = Array.isArray(decoded.accepts) ? decoded.accepts[0] : decoded;
                    if (first.maxAmountRequired) console.log(`     ${yellow("$")} Amount: ${first.maxAmountRequired} (${first.network ?? "unknown"})`);
                  } catch {
                  }
                }
              } else if (r.ok) {
                console.log(`     ${green("\u2713")} Endpoint reachable (free)`);
              }
            } catch {
              console.log(`     ${dim("\u26A0 Endpoint not reachable")}`);
            }
          }
        }
      }
      if (metadata.registrations?.length) {
        console.log(`
   ${bold("Cross-chain IDs:")}`);
        for (const reg of metadata.registrations) {
          console.log(`   ${dim("\u2022")} Agent #${reg.agentId} @ ${dim(reg.agentRegistry)}`);
        }
      }
    }
  } catch {
  }
  console.log();
}
async function showChains() {
  console.log(`
${bold("\u{1F310} Supported ERC-8004 chains")}
`);
  console.log(`   ${dim("Chain".padEnd(16))} ${dim("ID".padEnd(10))} ${dim("Registry")}
`);
  for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
    console.log(`   ${chain.name.padEnd(16)} ${id.padEnd(10)} ${dim(REGISTRY_ADDRESS)}`);
  }
  console.log(`
   ${bold(Object.keys(SUPPORTED_CHAINS).length.toString())} chains \u2014 same registry address on all.
`);
}
async function count(chainIdStr) {
  const chainIds = chainIdStr ? [Number(chainIdStr)] : Object.keys(SUPPORTED_CHAINS).map(Number);
  console.log(`
${bold("\u{1F4CA} Agent count")} ${dim("(scanning Transfer events)")}
`);
  const promises = chainIds.map(async (chainId) => {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) return { chainId, name: `Unknown (${chainId})`, count: -1 };
    try {
      const client = createPublicClient({ transport: http(chain.rpc) });
      const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: "0x0000000000000000000000000000000000000000" },
        fromBlock: 0n,
        toBlock: "latest"
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
  console.log(`
${bold("\u{1F680} Scaffold a new A3Stack agent")}
`);
  console.log(`${dim("Coming in v0.2.0 \u2014 for now, install the packages directly:")}
`);
  console.log(`   ${cyan("npm install @a3stack/core viem")}
`);
  console.log(`   Then in your code:
`);
  console.log(`   ${dim('import { A3Stack } from "@a3stack/core";')}`);
  console.log(`   ${dim("")}`);
  console.log(`   ${dim("const agent = new A3Stack({")}`);
  console.log(`   ${dim("  privateKey: process.env.PRIVATE_KEY,")}`);
  console.log(`   ${dim("  chainId: 8453,  // Base")}`);
  console.log(`   ${dim("});")}`);
  console.log(`   ${dim("")}`);
  console.log(`   ${dim('await agent.register({ name: "my-agent" });')}`);
  console.log(`   ${dim('console.log("Registered:", agent.globalId);')}
`);
  console.log(`   Docs: ${cyan("https://a3stack.arcabot.ai")}
`);
}
var HELP = `
${bold("a3stack")} \u2014 identity, payments, and data for AI agents

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

${dim(`v0.1.0 \u2022 https://a3stack.arcabot.ai \u2022 github.com/arcabotai/a3stack`)}
`;
var [cmd, ...args] = process.argv.slice(2);
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
    case "verify":
      return verify(args[0]);
    case "lookup":
      return lookup(args[0]);
    case "probe":
      return probe(args[0]);
    case "chains":
      return showChains();
    case "count":
      return count(args[0]);
    case "init":
      return scaffoldInit();
    default:
      console.error(`${red("Unknown command:")} ${cmd}
`);
      console.log(HELP);
      process.exit(1);
  }
}
main().catch((err) => {
  console.error(`${red("Error:")} ${err.message}`);
  process.exit(1);
});
