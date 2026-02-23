/**
 * @agent-stack/core — Type Definitions
 */

import type { Chain, Account } from "viem";
import type { RegisterOptions } from "@agent-stack/identity";
import type { PaymentServerConfig, PaymentClientConfig } from "@agent-stack/payments";

export interface AgentStackConfig {
  /**
   * viem Account (e.g. from privateKeyToAccount())
   * Must have signTransaction for on-chain write operations (register, setAgentURI)
   * Can be a read-only account (address only) for read/verify operations
   */
  account: Account;

  /**
   * viem Chain (e.g. import { base } from "viem/chains")
   */
  chain: Chain;

  /**
   * RPC URL override for the chain
   */
  rpc?: string;

  /**
   * MCP Server configuration.
   * If provided, this AgentStack instance can serve MCP tools.
   */
  server?: {
    name: string;
    version?: string;
    port?: number;
    cors?: boolean;
    /** Require payment to call tools */
    payment?: Omit<PaymentServerConfig, "payTo"> & { payTo?: `0x${string}` };
  };

  /**
   * Payment client configuration for calling other agents.
   * Defaults to auto-configured from account + chain.
   */
  payer?: Omit<PaymentClientConfig, "account">;
}

export interface AgentStackRegisterOptions extends RegisterOptions {
  /**
   * If true, auto-include the current MCP server URL in services.
   * Only valid if server.port is configured.
   */
  includeServerEndpoint?: boolean;
  /** Override the MCP URL to include in services */
  mcpUrl?: string;
}
