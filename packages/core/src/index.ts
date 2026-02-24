/**
 * @a3stack/core
 * A3Stack SDK — identity + payments + data for AI agents
 *
 * The all-in-one glue layer. Import just what you need:
 *   import { AgentStack } from "@a3stack/core"
 *
 * Or use individual packages for more control:
 *   import { AgentIdentity } from "@a3stack/identity"
 *   import { PaymentClient } from "@a3stack/payments"
 *   import { createAgentMcpServer } from "@a3stack/data"
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
  findAllRegistrations,
  IDENTITY_REGISTRY_ADDRESS,
  SUPPORTED_CHAINS,
} from "@a3stack/identity";

export type {
  AgentRegistrationFile,
  AgentService,
  AgentRef,
  VerificationResult,
  RegisterOptions,
  RegisterResult,
} from "@a3stack/identity";

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
} from "@a3stack/payments";

export type {
  PaymentClientConfig,
  PaymentServerConfig,
  PaymentDetails,
  PaymentBalance,
  PaymentVerifyResult,
} from "@a3stack/payments";

export {
  // Data / MCP
  createAgentMcpServer,
  createAgentMcpClient,
  AgentMcpServerInstance,
  AgentMcpClientInstance,
  probeAgent,
} from "@a3stack/data";

export type { AgentMcpServerConfig, AgentMcpClientConfig, AgentProbeResult } from "@a3stack/data";

export type { AgentStackConfig, AgentStackRegisterOptions } from "./types.js";
