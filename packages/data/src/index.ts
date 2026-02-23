/**
 * @agent-stack/data
 * MCP server/client helpers with built-in identity verification and payment gating
 */

export { AgentMcpServerInstance, createAgentMcpServer } from "./server.js";
export { AgentMcpClientInstance, createAgentMcpClient } from "./client.js";
export type { AgentMcpServerConfig, AgentMcpClientConfig, AgentMcpServer } from "./types.js";
