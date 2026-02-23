/**
 * createAgentMcpClient — MCP client with identity resolution + payment support
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpEndpoint, verifyAgent } from "@agent-stack/identity";
import { PaymentClient } from "@agent-stack/payments";
import type { AgentMcpClientConfig } from "./types.js";

type ToolResult = {
  content: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
};

type ResourceContent = {
  uri: string;
  text?: string;
  blob?: string;
  mimeType?: string;
};

/**
 * A connected MCP client with optional identity verification + payment
 */
export class AgentMcpClientInstance {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private config: AgentMcpClientConfig;
  private payer?: PaymentClient;
  private _agentVerification?: Awaited<ReturnType<typeof verifyAgent>>;
  private _url: URL;

  constructor(
    client: Client,
    transport: StreamableHTTPClientTransport,
    config: AgentMcpClientConfig,
    url: URL,
    payer?: PaymentClient,
    verification?: Awaited<ReturnType<typeof verifyAgent>>
  ) {
    this.client = client;
    this.transport = transport;
    this.config = config;
    this._url = url;
    this.payer = payer;
    this._agentVerification = verification;
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<
    Array<{ name: string; description?: string; inputSchema?: unknown }>
  > {
    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolResult> {
    return this.client.callTool({ name, arguments: args ?? {} }) as Promise<ToolResult>;
  }

  /**
   * List available resources from the server
   */
  async listResources(): Promise<Array<{ uri: string; name?: string; description?: string }>> {
    const result = await this.client.listResources();
    return result.resources;
  }

  /**
   * Read a resource at a given URI
   */
  async readResource(uri: string): Promise<ResourceContent[]> {
    const result = await this.client.readResource({ uri });
    return result.contents as ResourceContent[];
  }

  /**
   * Read the agent's identity resource (shorthand)
   */
  async getAgentIdentity(): Promise<Record<string, unknown> | null> {
    try {
      const contents = await this.readResource("agent://identity");
      if (!contents.length || !contents[0].text) return null;
      return JSON.parse(contents[0].text);
    } catch {
      return null;
    }
  }

  /**
   * Get the verification result for this agent (if connected by global ID)
   */
  get verification() {
    return this._agentVerification ?? null;
  }

  /**
   * Get the connected server URL
   */
  get url(): URL {
    return this._url;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * Connect to an MCP server by ERC-8004 global ID or direct URL.
 *
 * @example
 * // By identity
 * const client = await createAgentMcpClient({
 *   agentId: "eip155:8453:0x8004...#2376",
 *   payer: { account },
 * });
 *
 * @example
 * // By URL
 * const client = await createAgentMcpClient({ url: "https://mcp.agent.eth/mcp" });
 */
export async function createAgentMcpClient(
  config: AgentMcpClientConfig
): Promise<AgentMcpClientInstance> {
  if (!config.agentId && !config.url) {
    throw new Error("Must provide either agentId (ERC-8004 global ID) or url");
  }

  let mcpUrl: string;
  let verification: Awaited<ReturnType<typeof verifyAgent>> | undefined;

  if (config.agentId) {
    // Verify identity and resolve MCP endpoint
    verification = await verifyAgent(config.agentId);

    if (!verification.valid) {
      throw new Error(
        `Cannot connect to agent "${config.agentId}": ${verification.error ?? "Identity verification failed"}`
      );
    }

    const endpoint = await getMcpEndpoint(config.agentId);
    if (!endpoint) {
      throw new Error(
        `Agent "${config.agentId}" does not expose an MCP endpoint. ` +
          `Check their registration's services array for a "MCP" service entry.`
      );
    }

    mcpUrl = endpoint;
  } else {
    mcpUrl = config.url!;
  }

  // Set up payment client if payer is configured
  let payer: PaymentClient | undefined;
  if (config.payer) {
    payer = new PaymentClient({
      account: config.payer.account,
      maxAmountPerRequest: config.payer.maxAmount,
    });
  }

  // Create MCP client with optional payment-wrapped fetch
  const client = new Client({
    name: "agent-stack-client",
    version: "0.1.0",
  });

  const transportFetch = payer ? payer.fetch : fetch;
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    // Use payment-aware fetch if payer configured
    fetch: transportFetch as typeof fetch,
  });

  await client.connect(transport);

  return new AgentMcpClientInstance(client, transport, config, new URL(mcpUrl), payer, verification);
}
