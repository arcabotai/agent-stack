/**
 * @agent-stack/core
 * Agent Stack SDK — identity + payments + data for AI agents
 *
 * The all-in-one glue layer. Import just what you need:
 *   import { AgentStack } from "@agent-stack/core"
 *
 * Or use individual packages for more control:
 *   import { AgentIdentity } from "@agent-stack/identity"
 *   import { PaymentClient } from "@agent-stack/payments"
 *   import { createAgentMcpServer } from "@agent-stack/data"
 */

// Main class
export { AgentStack } from "./agent.js";

// Re-export everything from sub-packages for convenience
export {
  // Identity
  AgentIdentity,
  verifyAgent,
  parseAgentId,
  formatAgentId,
  fetchRegistrationFile,
  getMcpEndpoint,
  getA2aEndpoint,
  getAgentCount,
  IDENTITY_REGISTRY_ADDRESS,
  SUPPORTED_CHAINS,
} from "@agent-stack/identity";

export type {
  AgentRegistrationFile,
  AgentService,
  AgentRef,
  VerificationResult,
  RegisterOptions,
  RegisterResult,
} from "@agent-stack/identity";

export {
  // Payments
  PaymentClient,
  PaymentServer,
  createPaymentClient,
  createPaymentServer,
  USDC_BASE,
  USDC_ETH,
  DEFAULT_NETWORK,
  NETWORK_USDC,
} from "@agent-stack/payments";

export type {
  PaymentClientConfig,
  PaymentServerConfig,
  PaymentDetails,
  PaymentBalance,
  PaymentVerifyResult,
} from "@agent-stack/payments";

export {
  // Data / MCP
  createAgentMcpServer,
  createAgentMcpClient,
  AgentMcpServerInstance,
  AgentMcpClientInstance,
} from "@agent-stack/data";

export type { AgentMcpServerConfig, AgentMcpClientConfig } from "@agent-stack/data";

export type { AgentStackConfig, AgentStackRegisterOptions } from "./types.js";
