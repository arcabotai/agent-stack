/**
 * createAgentMcpServer — MCP server with built-in identity + payment support
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer, type RegisteredTool as McpRegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createPublicClient, http } from "viem";
import { z } from "zod";
import {
  fetchRegistrationFile,
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_ABI,
  SUPPORTED_CHAINS,
} from "@agent-stack/identity";
import { PaymentServer, USDC_BASE, DEFAULT_NETWORK } from "@agent-stack/payments";
import type { AgentMcpServerConfig } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolHandler<T = any> = (args: T) => Promise<CallToolResult>;

interface InternalRegisteredTool {
  requiresPayment: boolean;
}

/**
 * Agent MCP Server wrapping @modelcontextprotocol/sdk with payment + identity support
 */
export class AgentMcpServerInstance {
  private config: Required<Omit<AgentMcpServerConfig, "payment" | "identity">> & {
    payment?: AgentMcpServerConfig["payment"];
    identity?: AgentMcpServerConfig["identity"];
  };
  private mcp: McpServer;
  private paymentServer?: PaymentServer;
  private tools = new Map<string, InternalRegisteredTool>();
  private httpServer?: ReturnType<typeof createServer>;

  constructor(config: AgentMcpServerConfig) {
    this.config = {
      name: config.name,
      version: config.version,
      port: config.port ?? 3000,
      cors: config.cors ?? true,
      identity: config.identity,
      payment: config.payment,
    };

    this.mcp = new McpServer({
      name: config.name,
      version: config.version,
    });

    if (config.payment) {
      this.paymentServer = new PaymentServer({
        payTo: config.payment.payTo,
        amount: config.payment.amount,
        asset: config.payment.asset ?? USDC_BASE,
        network: config.payment.network ?? DEFAULT_NETWORK,
        description: config.payment.description ?? `${config.name} MCP service`,
        maxTimeoutSeconds: config.payment.maxTimeoutSeconds,
      });
    }

    // Register built-in tools
    this._registerBuiltinTools();

    // Register identity resource if configured
    if (config.identity) {
      this._registerIdentityResource();
    }
  }

  private _registerBuiltinTools() {
    // Ping — always free
    this.mcp.tool(
      "ping",
      "Check if the server is alive",
      {},
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "ok",
              server: this.config.name,
              version: this.config.version,
              timestamp: new Date().toISOString(),
              requiresPayment: !!this.config.payment,
              ...(this.config.payment
                ? {
                    paymentInfo: {
                      amount: this.config.payment.amount,
                      network: this.config.payment.network ?? DEFAULT_NETWORK,
                      payTo: this.config.payment.payTo,
                    },
                  }
                : {}),
            }),
          },
        ],
      })
    );
  }

  private _registerIdentityResource() {
    const identityConfig = this.config.identity!;

    // Register as MCP resource at agent://identity
    this.mcp.resource(
      "agent-identity",
      "agent://identity",
      { description: "The agent's ERC-8004 on-chain identity registration", mimeType: "application/json" },
      async (_uri: URL) => {
        try {
          const chainDefaults = SUPPORTED_CHAINS[identityConfig.chainId];
          const rpcUrl = identityConfig.rpc ?? chainDefaults?.rpc;

          if (!rpcUrl) {
            return {
              contents: [
                {
                  uri: "agent://identity",
                  text: JSON.stringify({
                    error: `No RPC available for chain ${identityConfig.chainId}`,
                  }),
                  mimeType: "application/json",
                },
              ],
            };
          }

          const client = createPublicClient({ transport: http(rpcUrl) });
          const registry = identityConfig.registry ?? IDENTITY_REGISTRY_ADDRESS;

          const agentUri = (await client.readContract({
            address: registry,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: "tokenURI",
            args: [BigInt(identityConfig.agentId)],
          })) as string;

          const registration = await fetchRegistrationFile(agentUri);

          return {
            contents: [
              {
                uri: "agent://identity",
                text: JSON.stringify(
                  {
                    globalId: `eip155:${identityConfig.chainId}:${registry}#${identityConfig.agentId}`,
                    ...registration,
                  },
                  null,
                  2
                ),
                mimeType: "application/json",
              },
            ],
          };
        } catch (e) {
          return {
            contents: [
              {
                uri: "agent://identity",
                text: JSON.stringify({ error: (e as Error).message }),
                mimeType: "application/json",
              },
            ],
          };
        }
      }
    );
  }

  /**
   * Register a tool (wraps McpServer.tool())
   * The handler must return a CallToolResult-compatible object.
   */
  tool(
    name: string,
    description: string,
    paramsSchema: Record<string, z.ZodTypeAny>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: ToolHandler<any>
  ): McpRegisteredTool {
    const freeTools = this.config.payment?.freeTools ?? ["ping"];
    this.tools.set(name, {
      requiresPayment: !!this.config.payment && !freeTools.includes(name),
    });
    return this.mcp.tool(name, description, paramsSchema, handler);
  }

  /**
   * Register a resource (wraps McpServer.resource())
   */
  resource(
    name: string,
    uri: string,
    description: string,
    handler: (uri: URL) => Promise<{ contents: Array<{ uri: string; text: string; mimeType?: string }> }>
  ): void {
    this.mcp.resource(name, uri, { description }, handler);
  }

  /**
   * Start the HTTP server
   */
  async listen(port?: number): Promise<{ url: string }> {
    const listenPort = port ?? this.config.port;
    const transports = new Map<string, StreamableHTTPServerTransport>();

    this.httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // CORS headers
      if (this.config.cors) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, MCP-Session-Id, X-PAYMENT, X-PAYMENT-REQUIRED"
        );
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
      }

      // Only handle /mcp path
      if (req.url !== "/mcp" && req.url !== "/") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found", hint: "MCP endpoint is at /mcp" }));
        return;
      }

      // Check payment for POST requests (tool calls)
      if (req.method === "POST" && this.paymentServer) {
        const paymentHeader = req.headers["x-payment"] as string | undefined;

        if (!paymentHeader) {
          const requirementsHeader = this.paymentServer.buildRequirementsHeader(
            `https://${req.headers.host ?? "localhost"}${req.url ?? "/mcp"}`
          );
          res.writeHead(402, {
            "Content-Type": "application/json",
            "X-PAYMENT-REQUIRED": requirementsHeader,
          });
          res.end(
            JSON.stringify({
              error: "Payment Required",
              message:
                `This MCP server requires x402 payment. ` +
                `Use a payment-capable client or pay ${this.config.payment!.amount} USDC on ${this.config.payment!.network ?? DEFAULT_NETWORK}.`,
            })
          );
          return;
        }

        const payResult = await this.paymentServer.verify(req);
        if (!payResult.valid) {
          res.writeHead(402, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Invalid Payment", message: payResult.error })
          );
          return;
        }
      }

      // Handle MCP protocol
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId && req.method === "POST") {
        // New session
        const newSessionId = randomUUID();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });
        transports.set(newSessionId, transport);
        transport.onclose = () => {
          transports.delete(newSessionId);
        };
        await this.mcp.connect(transport);
      } else if (req.method === "GET") {
        // SSE connection for existing session — create standalone transport for streaming
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless for GET
        });
        await this.mcp.connect(transport);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Bad Request", message: "Missing MCP-Session-Id" }));
        return;
      }

      await transport.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(listenPort, resolve);
    });

    const url = `http://localhost:${listenPort}/mcp`;
    return { url };
  }

  /**
   * Stop the server
   */
  async close(): Promise<void> {
    await this.mcp.close();
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  /** Access the raw McpServer for advanced usage */
  get server(): McpServer {
    return this.mcp;
  }
}

/**
 * Create an MCP server with built-in identity + payment support
 */
export function createAgentMcpServer(
  config: AgentMcpServerConfig
): AgentMcpServerInstance {
  return new AgentMcpServerInstance(config);
}
