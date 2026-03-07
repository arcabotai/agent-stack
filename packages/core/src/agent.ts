/**
 * A3Stack — the all-in-one glue layer
 * Combines identity + payments + data into one clean interface
 */

import type { Account } from "viem";
import { z } from "zod";
import { AgentIdentity, AgentDiscovery, verifyAgent, getMcpEndpoint, IDENTITY_REGISTRY_ADDRESS } from "@a3stack/identity";
import type { VerificationResult, DiscoveredAgent, ReputationSummary, FeedbackEntry, AgentSearchFilters, GiveFeedbackOptions } from "@a3stack/identity";
import { PaymentClient } from "@a3stack/payments";
import { AgentMcpServerInstance, createAgentMcpClient, probeAgent } from "@a3stack/data";
import type { AgentProbeResult } from "@a3stack/data";
import type { AgentMcpClientInstance } from "@a3stack/data";
import type { A3StackConfig, A3StackRegisterOptions } from "./types.js";

export class A3Stack {
  private config: A3StackConfig;
  private identity: AgentIdentity;
  private _discovery?: AgentDiscovery;
  private payer: PaymentClient;
  private mcpServer?: AgentMcpServerInstance;
  private _agentId?: number;
  private _serverUrl?: string;

  constructor(config: A3StackConfig) {
    this.config = config;

    // Initialize identity manager
    this.identity = new AgentIdentity({
      account: config.account,
      chain: config.chain,
      rpc: config.rpc,
    });

    // Initialize payment client
    this.payer = new PaymentClient({
      account: config.account,
      chains: [`eip155:${config.chain.id}`, "eip155:*"],
      ...config.payer,
    });

    // Initialize MCP server if configured
    if (config.server) {
      // Determine payTo address (default to agent's own wallet)
      const payTo = config.server.payment?.payTo ?? config.account.address;

      this.mcpServer = new AgentMcpServerInstance({
        name: config.server.name,
        version: config.server.version ?? "0.1.0",
        port: config.server.port ?? 3000,
        cors: config.server.cors ?? true,
        payment: config.server.payment
          ? {
              ...config.server.payment,
              payTo,
            }
          : undefined,
      });
    }
  }

  /**
   * Register this agent on-chain via ERC-8004.
   * Call this once to create your agent identity.
   */
  async register(options: A3StackRegisterOptions): Promise<{
    agentId: number;
    txHash: `0x${string}`;
    globalId: string;
  }> {
    // Check if already registered
    const { registered } = await this.identity.isRegistered();
    if (registered) {
      throw new Error(
        `Agent is already registered on chain ${this.config.chain.id}. ` +
          `Use updateIdentity() to change your registration.`
      );
    }

    // Auto-add MCP server endpoint if configured
    const services = [...(options.services ?? [])];
    if (
      options.includeServerEndpoint !== false &&
      this.config.server &&
      this._serverUrl
    ) {
      const hasMcp = services.some((s) => s.name.toUpperCase() === "MCP");
      if (!hasMcp) {
        services.push({
          name: "MCP",
          endpoint: options.mcpUrl ?? this._serverUrl,
          version: "2025-06-18",
        });
      }
    }

    const result = await this.identity.register({ ...options, services });
    this._agentId = result.agentId;
    return result;
  }

  /**
   * Start the MCP server (if configured).
   * Returns the server URL.
   */
  async start(port?: number): Promise<{ url: string }> {
    if (!this.mcpServer) {
      throw new Error(
        "No server configured. Pass server config to A3Stack constructor."
      );
    }
    const result = await this.mcpServer.listen(port);
    this._serverUrl = result.url;
    return result;
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.mcpServer?.close();
  }

  /**
   * Register a tool on this agent's MCP server.
   * Handler must return a CallToolResult: { content: [{ type: "text", text: string }] }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool(
    name: string,
    description: string,
    paramsSchema: Record<string, z.ZodTypeAny>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => Promise<any>
  ): void {
    if (!this.mcpServer) {
      throw new Error("No server configured. Pass server config to A3Stack constructor.");
    }
    this.mcpServer.tool(name, description, paramsSchema, handler);
  }

  /**
   * Register a resource on this agent's MCP server
   */
  resource(
    name: string,
    uri: string,
    description: string,
    handler: (uri: URL) => Promise<{ contents: Array<{ uri: string; text: string; mimeType?: string }> }>
  ): void {
    if (!this.mcpServer) {
      throw new Error("No server configured.");
    }
    this.mcpServer.resource(name, uri, description, handler);
  }

  /**
   * Connect to another agent by ERC-8004 global ID.
   * Auto-resolves MCP endpoint and handles payment.
   */
  async connect(agentGlobalId: string): Promise<AgentMcpClientInstance> {
    return createAgentMcpClient({
      agentId: agentGlobalId,
      payer: {
        account: this.config.account,
        maxAmount: this.config.payer?.maxAmountPerRequest,
      },
    });
  }

  /**
   * Connect to another agent by direct URL (no identity verification)
   */
  async connectUrl(url: string): Promise<AgentMcpClientInstance> {
    return createAgentMcpClient({
      url,
      payer: {
        account: this.config.account,
        maxAmount: this.config.payer?.maxAmountPerRequest,
      },
    });
  }

  /**
   * Verify another agent's identity before interacting
   */
  async verify(agentGlobalId: string): Promise<VerificationResult> {
    return verifyAgent(agentGlobalId);
  }

  /**
   * Probe another agent — discover capabilities without connecting.
   * Returns identity, endpoints, payment requirements, services.
   * Read-only, no wallet needed for the target agent.
   */
  async probe(agentGlobalId: string): Promise<AgentProbeResult> {
    return probeAgent(agentGlobalId);
  }

  /**
   * Get another agent's MCP endpoint
   */
  async getMcpEndpoint(agentGlobalId: string): Promise<string | null> {
    return getMcpEndpoint(agentGlobalId);
  }

  /**
   * Check USDC balance on current chain
   */
  async getBalance() {
    return this.payer.getBalance(`eip155:${this.config.chain.id}`, this.config.rpc);
  }

  /**
   * The payment-wrapped fetch for making calls to paid APIs
   */
  get fetch() {
    return this.payer.fetch;
  }

  /**
   * Current agent ID (set after register())
   */
  get agentId(): number | undefined {
    return this._agentId;
  }

  /**
   * Current global agent ID (set after register() + start())
   */
  get globalId(): string | undefined {
    if (!this._agentId) return undefined;
    return `eip155:${this.config.chain.id}:${IDENTITY_REGISTRY_ADDRESS}#${this._agentId}`;
  }

  /**
   * MCP server URL (set after start())
   */
  get serverUrl(): string | undefined {
    return this._serverUrl;
  }

  /**
   * Raw identity manager for advanced ERC-8004 operations
   */
  get identityManager(): AgentIdentity {
    return this.identity;
  }

  /**
   * Raw payment client for advanced payment operations
   */
  get paymentClient(): PaymentClient {
    return this.payer;
  }

  /**
   * Raw MCP server for advanced operations
   */
  get mcpServerInstance(): AgentMcpServerInstance | undefined {
    return this.mcpServer;
  }

  // ── Discovery & Reputation (powered by ag0 SDK) ──────────────

  /**
   * Get or create the discovery client.
   * Lazy-initialized — no overhead if you don't use it.
   */
  get discovery(): AgentDiscovery {
    if (!this._discovery) {
      this._discovery = new AgentDiscovery({
        chainId: this.config.chain.id,
        rpcUrl: this.config.rpc ?? this.config.chain.rpcUrls?.default?.http?.[0] ?? "",
      });
    }
    return this._discovery;
  }

  /**
   * Search for agents across the ecosystem.
   * Uses ag0's subgraph for cross-chain indexed search.
   *
   * @example
   *   const agents = await stack.discover({ name: "weather" });
   *   const trusted = await stack.discover({ feedback: { minValue: 80 } });
   */
  async discover(filters: AgentSearchFilters = {}): Promise<DiscoveredAgent[]> {
    return this.discovery.search(filters);
  }

  /**
   * Get reputation summary for an agent.
   * Returns count + average score (0-100).
   *
   * @example
   *   const rep = await stack.reputation("8453:102");
   *   console.log(`Score: ${rep.averageValue}/100 (${rep.count} reviews)`);
   */
  async reputation(agentId: string): Promise<ReputationSummary> {
    return this.discovery.getReputation(agentId);
  }

  /**
   * Get feedback entries for an agent.
   *
   * @example
   *   const reviews = await stack.feedback("1:22775");
   *   for (const r of reviews) {
   *     console.log(`${r.value}/100 by ${r.reviewer} — ${r.tags.join(", ")}`);
   *   }
   */
  async feedback(agentId: string): Promise<FeedbackEntry[]> {
    return this.discovery.getFeedback(agentId);
  }
}
