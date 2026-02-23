/**
 * ERC-8004 Agent Identity Types
 */

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
}

export interface AgentRegistrationFile {
  type: string;
  name: string;
  description: string;
  image?: string;
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: AgentRegistrationRef[];
  supportedTrust?: string[];
}

export interface AgentRegistrationRef {
  agentId: number;
  agentRegistry: string; // "eip155:{chainId}:{registryAddress}"
}

export interface AgentRef {
  namespace: string;        // "eip155"
  chainId: number;          // 8453
  registry: `0x${string}`; // "0x8004..."
  agentId: number;          // 2376
}

export interface VerificationResult {
  valid: boolean;
  agentId: number;
  owner: `0x${string}` | null;
  paymentWallet: `0x${string}` | null;
  registration: AgentRegistrationFile | null;
  globalId: string;
  error?: string;
}

export interface RegisterOptions {
  name: string;
  description: string;
  image?: string;
  services?: AgentService[];
  x402Support?: boolean;
  active?: boolean;
  supportedTrust?: string[];
  /** Extra cross-chain registrations to include in the file */
  existingRegistrations?: AgentRegistrationRef[];
  /** Store as data URI (on-chain) vs IPFS URL. Default: data URI */
  storage?: "data-uri" | "ipfs";
  /** Optional gas limit override */
  gasLimit?: bigint;
}

export interface RegisterResult {
  agentId: number;
  txHash: `0x${string}`;
  globalId: string;
  agentUri: string;
}

export interface IdentityConfig {
  /**
   * viem Account (e.g. from privateKeyToAccount())
   * For read-only operations, a partial account with just address works.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any;
  /**
   * viem Chain object (e.g. import { base } from "viem/chains")
   * Any object with at least { id, name } works.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain: any;
  /** RPC URL override */
  rpc?: string;
  /** Registry contract address override */
  registry?: `0x${string}`;
}

export interface DiscoverOptions {
  chain?: {
    id: number;
    rpcUrls?: { default?: { http?: string[] } };
  };
  /** Filter agents that have this service type (e.g. "MCP") */
  hasService?: string;
  /** Filter by x402Support flag */
  x402Support?: boolean;
  /** Filter by active flag */
  active?: boolean;
  /** Max number of results */
  limit?: number;
}
