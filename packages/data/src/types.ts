/**
 * @agent-stack/data — Type Definitions
 */

import type { PaymentServerConfig } from "@agent-stack/payments";

export interface AgentMcpServerConfig {
  /** MCP server name (shown to clients) */
  name: string;
  /** MCP server version */
  version: string;

  /**
   * Auto-expose the agent's ERC-8004 identity as an MCP resource.
   * If provided, adds an "agent://identity" resource.
   */
  identity?: {
    chainId: number;
    agentId: number;
    registry?: `0x${string}`;
    rpc?: string;
  };

  /**
   * Require x402 payment before serving paid tools.
   * Free tools (like ping, identity) are always accessible.
   */
  payment?: PaymentServerConfig & {
    /** Tool names that don't require payment. Defaults to ["ping"] */
    freeTools?: string[];
  };

  /** Port to listen on. Defaults to 3000. */
  port?: number;

  /** Enable CORS. Defaults to true. */
  cors?: boolean;
}

export interface AgentMcpClientConfig {
  /**
   * Connect by ERC-8004 global ID — auto-resolves MCP endpoint.
   * Format: "eip155:{chainId}:{registry}#{agentId}"
   */
  agentId?: string;

  /** Connect by direct MCP URL */
  url?: string;

  /**
   * If the server requires x402 payment, configure a payer.
   * If not provided, the client will fail on 402 responses.
   */
  payer?: {
    /** viem Account (e.g. from privateKeyToAccount()) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any;
    /** Max USDC to auto-pay per session. Default: 10 USDC */
    maxAmount?: string;
  };
}

export interface AgentMcpServer {
  /** The underlying McpServer instance */
  mcp: unknown;
  /**
   * Register a tool (passthrough to McpServer.tool())
   */
  tool(name: string, paramsSchema: unknown, handler: unknown): void;
  /**
   * Register a resource (passthrough to McpServer.resource())
   */
  resource(name: string, uri: string, handler: unknown): void;
  /**
   * Start listening
   */
  listen(port?: number): Promise<{ url: string }>;
  /**
   * Stop the server
   */
  close(): Promise<void>;
}
