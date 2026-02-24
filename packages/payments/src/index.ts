/**
 * @a3stack/payments
 * x402 payment flows for AI agents — client (paying) and server (receiving)
 */

export { PaymentClient, createPaymentClient } from "./client.js";
export { PaymentServer, createPaymentServer } from "./server.js";
export {
  USDC_BASE,
  USDC_ETH,
  USDC_POLYGON,
  USDC_ARBITRUM,
  USDC_OPTIMISM,
  NETWORK_USDC,
  DEFAULT_NETWORK,
  DEFAULT_MAX_AMOUNT,
} from "./constants.js";
export type {
  PaymentClientConfig,
  PaymentServerConfig,
  PaymentDetails,
  PaymentBalance,
  PaymentVerifyResult,
  PaymentRequirements,
  PaymentContext,
} from "./types.js";
