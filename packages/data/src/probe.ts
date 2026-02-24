/**
 * probeAgent — discover what an agent offers before connecting
 * 
 * Resolves identity, checks payment requirements, lists available endpoints.
 * All read-only, no wallet needed.
 */

import { verifyAgent, getMcpEndpoint, getA2aEndpoint, parseAgentId } from "@a3stack/identity";
import type { AgentRegistrationFile, VerificationResult } from "@a3stack/identity";

export interface AgentProbeResult {
  /** The global agent ID that was probed */
  globalId: string;

  /** Whether the agent's identity is verified on-chain */
  verified: boolean;

  /** The owner wallet address */
  owner: string | null;

  /** The payment wallet (or null if defaults to owner) */
  paymentWallet: string | null;

  /** The full registration file (if fetchable) */
  registration: AgentRegistrationFile | null;

  /** Resolved service endpoints */
  endpoints: {
    mcp: string | null;
    a2a: string | null;
    web: string | null;
  };

  /** Whether the agent accepts x402 payments */
  acceptsPayment: boolean;

  /** Whether the agent is marked as active */
  active: boolean;

  /** All services exposed */
  services: Array<{ name: string; endpoint: string; version?: string }>;

  /** Cross-chain registrations */
  registrations: Array<{ agentId: number; agentRegistry: string }>;

  /** Payment details from probing the MCP endpoint (if reachable) */
  paymentRequirements?: {
    amount?: string;
    network?: string;
    payTo?: string;
  };

  /** Any error during probing */
  error?: string;
}

/**
 * Probe an agent to discover its capabilities without connecting.
 * Read-only operation — no wallet or payment needed.
 * 
 * @example
 * ```ts
 * const info = await probeAgent("eip155:8453:0x8004...#2376");
 * console.log(info.verified);              // true
 * console.log(info.endpoints.mcp);         // "https://mcp.agent.eth/mcp"
 * console.log(info.acceptsPayment);        // true
 * console.log(info.paymentRequirements);   // { amount: "10000", network: "eip155:8453" }
 * ```
 */
export async function probeAgent(globalId: string): Promise<AgentProbeResult> {
  const ref = parseAgentId(globalId);

  const result: AgentProbeResult = {
    globalId,
    verified: false,
    owner: null,
    paymentWallet: null,
    registration: null,
    endpoints: { mcp: null, a2a: null, web: null },
    acceptsPayment: false,
    active: false,
    services: [],
    registrations: [],
  };

  // Step 1: Verify on-chain identity
  let verification: VerificationResult;
  try {
    verification = await verifyAgent(globalId);
  } catch (e) {
    result.error = `Verification failed: ${(e as Error).message}`;
    return result;
  }

  result.verified = verification.valid;
  result.owner = verification.owner;
  result.paymentWallet = verification.paymentWallet;
  result.registration = verification.registration;

  if (!verification.valid) {
    result.error = verification.error ?? "Identity verification failed";
    return result;
  }

  // Step 2: Extract registration data
  if (verification.registration) {
    const reg = verification.registration;
    result.active = reg.active;
    result.acceptsPayment = reg.x402Support;
    result.services = reg.services ?? [];
    result.registrations = reg.registrations ?? [];

    // Resolve known endpoints
    const mcpSvc = reg.services?.find(s => s.name.toUpperCase() === "MCP");
    const a2aSvc = reg.services?.find(s => s.name.toUpperCase() === "A2A");
    const webSvc = reg.services?.find(s => s.name.toLowerCase() === "web");

    result.endpoints.mcp = mcpSvc?.endpoint ?? null;
    result.endpoints.a2a = a2aSvc?.endpoint ?? null;
    result.endpoints.web = webSvc?.endpoint ?? null;
  }

  // Step 3: If MCP endpoint exists and agent accepts payments, probe for requirements
  if (result.endpoints.mcp && result.acceptsPayment) {
    try {
      const response = await fetch(result.endpoints.mcp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 }),
      });

      if (response.status === 402) {
        const reqHeader = response.headers.get("x-payment-required") ??
          response.headers.get("X-PAYMENT-REQUIRED");
        if (reqHeader) {
          try {
            const decoded = JSON.parse(Buffer.from(reqHeader, "base64").toString("utf8"));
            const first = Array.isArray(decoded.accepts) ? decoded.accepts[0] : decoded;
            result.paymentRequirements = {
              amount: first.maxAmountRequired,
              network: first.network,
              payTo: first.payTo,
            };
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      // MCP endpoint not reachable — that's fine, not an error
    }
  }

  return result;
}
