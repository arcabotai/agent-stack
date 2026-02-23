/**
 * Agent identity verification and resolution
 */

import { createPublicClient, http } from "viem";
import {
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_ABI,
  ZERO_ADDRESS,
  SUPPORTED_CHAINS,
} from "./constants.js";
import type { AgentRef, VerificationResult, AgentRegistrationFile } from "./types.js";

/**
 * Parse an ERC-8004 global agent ID string
 * Format: "eip155:{chainId}:{registry}#{agentId}"
 * Example: "eip155:8453:0x8004...#2376"
 */
export function parseAgentId(globalId: string): AgentRef {
  // Support both "eip155:8453:0x8004...#2376" and "eip155:8453:0x8004.../2376"
  const normalized = globalId.replace("/", "#");
  const match = normalized.match(/^(eip155):(\d+):(0x[0-9a-fA-F]+)#(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid agent global ID format: "${globalId}"\n` +
        `Expected: "eip155:{chainId}:{registry}#{agentId}" (e.g. "eip155:8453:0x8004...#2376")`
    );
  }
  return {
    namespace: match[1],
    chainId: Number(match[2]),
    registry: match[3] as `0x${string}`,
    agentId: Number(match[4]),
  };
}

/**
 * Format a parsed AgentRef back to a global ID string
 */
export function formatAgentId(ref: AgentRef): string {
  return `${ref.namespace}:${ref.chainId}:${ref.registry}#${ref.agentId}`;
}

/**
 * Fetch and parse an agent's registration file from its URI
 * Handles: data: URIs, https:// URLs, ipfs:// CIDs (via gateway)
 */
export async function fetchRegistrationFile(
  agentUri: string,
  ipfsGateway = "https://ipfs.io/ipfs/"
): Promise<AgentRegistrationFile> {
  let json: string;

  if (agentUri.startsWith("data:application/json;base64,")) {
    const b64 = agentUri.slice("data:application/json;base64,".length);
    json = Buffer.from(b64, "base64").toString("utf8");
  } else if (agentUri.startsWith("data:application/json,")) {
    json = decodeURIComponent(agentUri.slice("data:application/json,".length));
  } else if (agentUri.startsWith("ipfs://")) {
    const cid = agentUri.slice("ipfs://".length);
    const response = await fetch(`${ipfsGateway}${cid}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS URI: ${agentUri} (${response.status})`);
    }
    json = await response.text();
  } else if (agentUri.startsWith("https://") || agentUri.startsWith("http://")) {
    const response = await fetch(agentUri, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch agent URI: ${agentUri} (${response.status})`);
    }
    json = await response.text();
  } else {
    throw new Error(
      `Unsupported URI scheme: "${agentUri}". ` +
        `Supported: data:, ipfs://, https://, http://`
    );
  }

  const parsed = JSON.parse(json) as AgentRegistrationFile;
  return parsed;
}

/**
 * Verify an agent's identity from its global ID
 * Performs full on-chain + off-chain verification
 */
export async function verifyAgent(
  globalIdOrRef:
    | string
    | { chainId: number; agentId: number; registry?: `0x${string}`; rpc?: string }
): Promise<VerificationResult> {
  let ref: AgentRef;

  if (typeof globalIdOrRef === "string") {
    ref = parseAgentId(globalIdOrRef);
  } else {
    ref = {
      namespace: "eip155",
      chainId: globalIdOrRef.chainId,
      registry: globalIdOrRef.registry ?? IDENTITY_REGISTRY_ADDRESS,
      agentId: globalIdOrRef.agentId,
    };
  }

  const globalId = formatAgentId(ref);
  const chainDefaults = SUPPORTED_CHAINS[ref.chainId];
  const rpcUrl =
    (typeof globalIdOrRef === "object" && "rpc" in globalIdOrRef
      ? globalIdOrRef.rpc
      : undefined) ??
    chainDefaults?.rpc;

  if (!rpcUrl) {
    return {
      valid: false,
      agentId: ref.agentId,
      owner: null,
      paymentWallet: null,
      registration: null,
      globalId,
      error: `No RPC URL available for chain ${ref.chainId}. Add to SUPPORTED_CHAINS or pass rpc option.`,
    };
  }

  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  try {
    // Step 1: Get owner
    const owner = (await client.readContract({
      address: ref.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "ownerOf",
      args: [BigInt(ref.agentId)],
    })) as `0x${string}`;

    // Step 2: Get payment wallet
    const paymentWalletRaw = (await client.readContract({
      address: ref.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getAgentWallet",
      args: [BigInt(ref.agentId)],
    })) as `0x${string}`;

    const paymentWallet =
      paymentWalletRaw === ZERO_ADDRESS ? null : paymentWalletRaw;

    // Step 3: Get agent URI and fetch registration file
    const agentUri = (await client.readContract({
      address: ref.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "tokenURI",
      args: [BigInt(ref.agentId)],
    })) as string;

    let registration: AgentRegistrationFile | null = null;
    try {
      registration = await fetchRegistrationFile(agentUri);
    } catch (e) {
      return {
        valid: false,
        agentId: ref.agentId,
        owner,
        paymentWallet,
        registration: null,
        globalId,
        error: `Failed to fetch registration file: ${(e as Error).message}`,
      };
    }

    // Step 4: Verify back-reference (registration file should list this chain's registration)
    const registryPrefix = `eip155:${ref.chainId}:${ref.registry.toLowerCase()}`;
    const hasBackref = registration.registrations?.some(
      (r) =>
        r.agentId === ref.agentId &&
        r.agentRegistry.toLowerCase() === registryPrefix
    );

    if (!hasBackref) {
      return {
        valid: false,
        agentId: ref.agentId,
        owner,
        paymentWallet,
        registration,
        globalId,
        error:
          `Registration file does not contain a back-reference to this chain's registry. ` +
          `Expected registrations entry: { agentId: ${ref.agentId}, agentRegistry: "${registryPrefix}" }`,
      };
    }

    return {
      valid: true,
      agentId: ref.agentId,
      owner,
      paymentWallet,
      registration,
      globalId,
    };
  } catch (e) {
    // ownerOf throws if token doesn't exist
    const message = (e as Error).message;
    return {
      valid: false,
      agentId: ref.agentId,
      owner: null,
      paymentWallet: null,
      registration: null,
      globalId,
      error: message.includes("revert") || message.includes("ERC721")
        ? `Agent #${ref.agentId} does not exist on chain ${ref.chainId}`
        : message,
    };
  }
}

/**
 * Get the MCP endpoint for an agent by resolving their registration
 */
export async function getMcpEndpoint(globalId: string): Promise<string | null> {
  const result = await verifyAgent(globalId);
  if (!result.valid || !result.registration) return null;

  const mcpService = result.registration.services.find(
    (s) => s.name.toUpperCase() === "MCP"
  );
  return mcpService?.endpoint ?? null;
}

/**
 * Get the A2A endpoint for an agent
 */
export async function getA2aEndpoint(globalId: string): Promise<string | null> {
  const result = await verifyAgent(globalId);
  if (!result.valid || !result.registration) return null;

  const a2aService = result.registration.services.find(
    (s) => s.name.toUpperCase() === "A2A"
  );
  return a2aService?.endpoint ?? null;
}

/**
 * Lightweight check: does this address own any agents on a given chain?
 */
export async function getAgentCount(
  address: `0x${string}`,
  chainId: number,
  rpc?: string
): Promise<number> {
  const chainDefaults = SUPPORTED_CHAINS[chainId];
  const rpcUrl = rpc ?? chainDefaults?.rpc;
  if (!rpcUrl) throw new Error(`No RPC for chain ${chainId}`);

  const client = createPublicClient({ transport: http(rpcUrl) });
  const balance = (await client.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;

  return Number(balance);
}
