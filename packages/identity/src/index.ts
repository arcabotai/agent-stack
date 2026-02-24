/**
 * @a3stack/identity
 * ERC-8004 agent identity: registration, verification, and discovery
 */

export { AgentIdentity } from "./registry.js";
export {
  parseAgentId,
  formatAgentId,
  fetchRegistrationFile,
  verifyAgent,
  getMcpEndpoint,
  getA2aEndpoint,
  getAgentCount,
} from "./verify.js";
export {
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_ABI,
  SUPPORTED_CHAINS,
  REGISTRATION_TYPE,
} from "./constants.js";
export { findAllRegistrations } from "./multichain.js";
export type { ChainRegistration } from "./multichain.js";
export type {
  AgentService,
  AgentRegistrationFile,
  AgentRegistrationRef,
  AgentRef,
  VerificationResult,
  RegisterOptions,
  RegisterResult,
  IdentityConfig,
  DiscoverOptions,
} from "./types.js";
