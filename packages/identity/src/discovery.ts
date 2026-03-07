/**
 * Agent Discovery & Reputation — powered by ag0 SDK
 *
 * Uses ag0's subgraph indexing for cross-chain agent search,
 * reputation queries, and feedback management.
 *
 * A3Stack handles registration + payments.
 * ag0 handles discovery + reputation.
 */

// ag0 SDK types are re-exported with A3Stack naming for consistency

export interface DiscoveredAgent {
  /** Cross-chain ID format: "{chainId}:{agentId}" */
  id: string;
  name: string;
  description: string;
  image?: string;
  owners: string[];
  operators: string[];
  /** A2A endpoint */
  a2a?: string;
  /** Website */
  web?: string;
  email?: string;
  ens?: string;
  walletAddress?: string;
  supportedTrusts: string[];
  active: boolean;
  x402support: boolean;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
  agentURI: string;
  feedbackCount: number;
  /** A2A advertised skills */
  a2aSkills: string[];
  /** MCP tools */
  mcpTools: string[];
  /** OASF skill taxonomy entries */
  oasfSkills: string[];
  oasfDomains: string[];
}

export interface AgentSearchFilters {
  /** Search by name (partial match) */
  name?: string;
  /** Filter by minimum feedback score */
  feedback?: { minValue?: number; reviewer?: string };
  /** Filter by skill name */
  skill?: string;
  /** Filter by domain */
  domain?: string;
  /** Filter by active status */
  active?: boolean;
  /** Filter by x402 support */
  x402?: boolean;
}

export interface ReputationSummary {
  /** Number of feedback entries */
  count: number;
  /** Average feedback value (0-100) */
  averageValue: number;
}

export interface FeedbackEntry {
  /** [agentId, reviewer, index] */
  id: [string, string, number];
  agentId: string;
  reviewer: string;
  /** Score 0-100 */
  value: number;
  tags: string[];
  endpoint?: string;
  createdAt: number;
  answers: string[];
  isRevoked: boolean;
}

export interface GiveFeedbackOptions {
  /** Agent ID in "{chainId}:{agentId}" format */
  agentId: string;
  /** Score 0-100 */
  value: number;
  /** Feedback comment */
  comment: string;
  /** Tags for categorization */
  tags?: string[];
}

export interface DiscoveryConfig {
  /** Chain ID for the ag0 SDK instance */
  chainId: number;
  /** RPC URL */
  rpcUrl: string;
  /** Private key for write operations (feedback). Optional for read-only. */
  privateKey?: string;
  /** IPFS provider: "pinata" | "filecoin" | "local" */
  ipfs?: string;
  /** Pinata JWT for IPFS uploads (if using pinata) */
  pinataJwt?: string;
}

/**
 * AgentDiscovery — search agents, check reputation, give feedback
 *
 * Wraps ag0 SDK for the discovery/reputation layer.
 * Use A3Stack's AgentIdentity for registration/write operations.
 */
export class AgentDiscovery {
  private sdk: any; // ag0 SDK instance
  private config: DiscoveryConfig;
  private initialized = false;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * Lazy-init the ag0 SDK (avoids import overhead if not used)
   */
  private async init(): Promise<void> {
    if (this.initialized) return;

    const { SDK } = await import("agent0-sdk");

    const sdkConfig: any = {
      chainId: this.config.chainId,
      rpcUrl: this.config.rpcUrl,
    };

    if (this.config.privateKey) {
      sdkConfig.privateKey = this.config.privateKey;
    }

    if (this.config.ipfs) {
      sdkConfig.ipfs = this.config.ipfs;
      if (this.config.pinataJwt) {
        sdkConfig.pinataJwt = this.config.pinataJwt;
      }
    }

    this.sdk = new SDK(sdkConfig);
    this.initialized = true;
  }

  /**
   * Search for agents across the subgraph index
   */
  async search(filters: AgentSearchFilters = {}): Promise<DiscoveredAgent[]> {
    await this.init();
    const results = await this.sdk.searchAgents(filters);
    return results as DiscoveredAgent[];
  }

  /**
   * Load a specific agent by ID ("{chainId}:{agentId}")
   */
  async getAgent(agentId: string): Promise<DiscoveredAgent | null> {
    await this.init();
    try {
      const agent = await this.sdk.loadAgent(agentId);
      return agent as DiscoveredAgent;
    } catch {
      return null;
    }
  }

  /**
   * Get reputation summary for an agent
   */
  async getReputation(agentId: string): Promise<ReputationSummary> {
    await this.init();
    return this.sdk.getReputationSummary(agentId);
  }

  /**
   * Search feedback entries for an agent
   */
  async getFeedback(agentId: string): Promise<FeedbackEntry[]> {
    await this.init();
    return this.sdk.searchFeedback({ agentId });
  }

  /**
   * Give feedback to an agent (requires private key in config)
   */
  async giveFeedback(options: GiveFeedbackOptions): Promise<string> {
    await this.init();
    if (!this.config.privateKey) {
      throw new Error(
        "Cannot give feedback without a private key. " +
          "Pass privateKey in DiscoveryConfig."
      );
    }
    return this.sdk.giveFeedback(
      options.agentId,
      options.value,
      options.comment,
      options.tags ?? []
    );
  }

  /**
   * Get the raw ag0 SDK instance for advanced operations
   */
  async getRawSdk(): Promise<any> {
    await this.init();
    return this.sdk;
  }
}
