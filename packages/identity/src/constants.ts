/**
 * ERC-8004 contract addresses and ABIs
 */

/**
 * ERC-8004 Identity Registry — deployed at same address on all supported chains
 * The address 0x8004... is a vanity address (mirrors the EIP number)
 * Verified on-chain: has bytecode on Base (8453) and Ethereum (1)
 */
export const IDENTITY_REGISTRY_ADDRESS =
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

/**
 * Chains where ERC-8004 is confirmed deployed (as of Feb 2026)
 */
export const SUPPORTED_CHAINS: Record<
  number,
  { name: string; rpc: string; chainId: number }
> = {
  1: { name: "Ethereum", rpc: "https://eth.llamarpc.com", chainId: 1 },
  8453: { name: "Base", rpc: "https://mainnet.base.org", chainId: 8453 },
  10: { name: "Optimism", rpc: "https://mainnet.optimism.io", chainId: 10 },
  42161: { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc", chainId: 42161 },
  137: { name: "Polygon", rpc: "https://polygon-rpc.com", chainId: 137 },
  56: { name: "BNB Chain", rpc: "https://bsc-dataseed.binance.org", chainId: 56 },
  100: { name: "Gnosis", rpc: "https://rpc.gnosischain.com", chainId: 100 },
  42220: { name: "Celo", rpc: "https://forno.celo.org", chainId: 42220 },
  59144: { name: "Linea", rpc: "https://rpc.linea.build", chainId: 59144 },
  534352: { name: "Scroll", rpc: "https://rpc.scroll.io", chainId: 534352 },
  167000: { name: "Taiko", rpc: "https://rpc.mainnet.taiko.xyz", chainId: 167000 },
  43114: { name: "Avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc", chainId: 43114 },
  5000: { name: "Mantle", rpc: "https://rpc.mantle.xyz", chainId: 5000 },
  1088: { name: "Metis", rpc: "https://andromeda.metis.io/?owner=1088", chainId: 1088 },
  2741: { name: "Abstract", rpc: "https://api.mainnet.abs.xyz", chainId: 2741 },
  143: { name: "Monad", rpc: "https://rpc.monad.xyz", chainId: 143 },
};

/**
 * ERC-8004 Identity Registry ABI
 */
export const IDENTITY_REGISTRY_ABI = [
  // Core registration
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "metadataKeys", type: "string[]" },
      { name: "metadataValues", type: "bytes[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  // ERC-721 standard
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  // Transfer event (for extracting agentId from receipt)
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  // Payment wallet
  {
    name: "setAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "unsetAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  // On-chain metadata
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "setMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const REGISTRATION_TYPE =
  "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

/** Zero address — returned when no payment wallet is set */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
