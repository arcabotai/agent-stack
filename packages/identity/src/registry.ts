/**
 * AgentIdentity — register and manage ERC-8004 agent identity
 */

import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import type { Account, Chain, WalletClient } from "viem";
import {
  IDENTITY_REGISTRY_ADDRESS,
  IDENTITY_REGISTRY_ABI,
  REGISTRATION_TYPE,
  ZERO_ADDRESS,
  SUPPORTED_CHAINS,
} from "./constants.js";
import type {
  IdentityConfig,
  RegisterOptions,
  RegisterResult,
  AgentRegistrationFile,
} from "./types.js";

export class AgentIdentity {
  private config: IdentityConfig;
  private registry: `0x${string}`;
  private rpcUrl: string;

  constructor(config: IdentityConfig) {
    this.config = config;
    this.registry = config.registry ?? IDENTITY_REGISTRY_ADDRESS;

    // Resolve RPC URL
    const chainDefaults = SUPPORTED_CHAINS[config.chain.id];
    this.rpcUrl =
      config.rpc ??
      config.chain.rpcUrls?.default?.http?.[0] ??
      chainDefaults?.rpc ??
      "";

    if (!this.rpcUrl) {
      throw new Error(
        `No RPC URL provided for chain ${config.chain.id}. Pass rpc option or use a supported chain.`
      );
    }
  }

  private getPublicClient() {
    return createPublicClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain: this.config.chain as any,
      transport: http(this.rpcUrl),
    });
  }

  private getWalletClient() {
    // The account must be a full viem Account for write operations
    if (!this.config.account?.signTransaction && !this.config.account?.sign) {
      throw new Error(
        "Write operations require a full viem Account with signing capability. " +
          "Use privateKeyToAccount() from viem/accounts."
      );
    }
    return createWalletClient({
      account: this.config.account as Account,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain: this.config.chain as any,
      transport: http(this.rpcUrl),
    });
  }

  /**
   * Build the registration JSON and encode as data URI
   */
  buildRegistrationUri(options: RegisterOptions, agentId?: number): string {
    const chainId = this.config.chain.id;
    const registrations = options.existingRegistrations
      ? [...options.existingRegistrations]
      : [];

    // Add current chain registration if we have an agentId
    if (agentId !== undefined) {
      registrations.unshift({
        agentId,
        agentRegistry: `eip155:${chainId}:${this.registry}`,
      });
    }

    const file: AgentRegistrationFile = {
      type: REGISTRATION_TYPE,
      name: options.name,
      description: options.description,
      ...(options.image ? { image: options.image } : {}),
      services: options.services ?? [],
      x402Support: options.x402Support ?? false,
      active: options.active ?? true,
      registrations,
      ...(options.supportedTrust ? { supportedTrust: options.supportedTrust } : {}),
    };

    const json = JSON.stringify(file);
    return "data:application/json;base64," + Buffer.from(json).toString("base64");
  }

  /**
   * Check if this wallet is already registered on the current chain
   */
  async isRegistered(): Promise<{ registered: boolean; agentId?: number }> {
    const client = this.getPublicClient();
    const balance = await client.readContract({
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf",
      args: [this.config.account.address],
    });

    if (balance === 0n) {
      return { registered: false };
    }

    // We'd need to scan Transfer events to find the agentId — return basic result
    return { registered: true };
  }

  /**
   * Register this agent on the current chain
   */
  async register(options: RegisterOptions): Promise<RegisterResult> {
    const walletClient = this.getWalletClient();

    // Build a temporary URI without agentId first (we don't know it yet)
    // We'll build it with a placeholder, then update after we have the ID
    const placeholderUri = this.buildRegistrationUri(options);

    // Estimate gas if not provided
    const publicClient = this.getPublicClient();

    const { request } = await publicClient.simulateContract({
      account: this.config.account as Account,
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [placeholderUri],
    });

    const txHash = await walletClient.writeContract({
      ...request,
      ...(options.gasLimit ? { gas: options.gasLimit } : {}),
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Extract agentId from Transfer event (ERC-721 mint: from=0x0)
    const logs = parseEventLogs({
      abi: IDENTITY_REGISTRY_ABI,
      eventName: "Transfer",
      logs: receipt.logs,
    });

    const mintLog = logs.find(
      (log) =>
        "args" in log &&
        log.args.from === ZERO_ADDRESS
    );

    if (!mintLog || !("args" in mintLog)) {
      throw new Error("Could not find Transfer event in registration receipt");
    }

    const agentId = Number(mintLog.args.tokenId);
    const chainId = this.config.chain.id;

    // Now update the URI with the actual agentId
    const finalUri = this.buildRegistrationUri(options, agentId);
    await this.setAgentURI(agentId, finalUri);

    const globalId = `eip155:${chainId}:${this.registry}#${agentId}`;

    return { agentId, txHash, globalId, agentUri: finalUri };
  }

  /**
   * Update the agent's URI (registration file location)
   */
  async setAgentURI(agentId: number, newUri: string): Promise<`0x${string}`> {
    const walletClient = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const { request } = await publicClient.simulateContract({
      account: this.config.account as Account,
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "setAgentURI",
      args: [BigInt(agentId), newUri],
    });

    return walletClient.writeContract(request);
  }

  /**
   * Get the agentURI for a given agentId
   */
  async getAgentURI(agentId: number): Promise<string> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "tokenURI",
      args: [BigInt(agentId)],
    }) as Promise<string>;
  }

  /**
   * Get the payment wallet for a given agentId
   */
  async getPaymentWallet(agentId: number): Promise<`0x${string}` | null> {
    const client = this.getPublicClient();
    const wallet = (await client.readContract({
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getAgentWallet",
      args: [BigInt(agentId)],
    })) as `0x${string}`;

    return wallet === ZERO_ADDRESS ? null : wallet;
  }

  /**
   * Get on-chain metadata for an agent
   */
  async getMetadata(agentId: number, key: string): Promise<string | null> {
    const client = this.getPublicClient();
    const raw = (await client.readContract({
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getMetadata",
      args: [BigInt(agentId), key],
    })) as `0x${string}`;

    if (!raw || raw === "0x") return null;
    return Buffer.from(raw.slice(2), "hex").toString("utf8");
  }

  /**
   * Set on-chain metadata for an agent (requires ownership)
   */
  async setMetadata(agentId: number, key: string, value: string): Promise<`0x${string}`> {
    const walletClient = this.getWalletClient();
    const publicClient = this.getPublicClient();

    const valueBytes = `0x${Buffer.from(value, "utf8").toString("hex")}` as `0x${string}`;
    const { request } = await publicClient.simulateContract({
      account: this.config.account as Account,
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "setMetadata",
      args: [BigInt(agentId), key, valueBytes],
    });

    return walletClient.writeContract(request);
  }

  /**
   * Get the owner of an agent
   */
  async getOwner(agentId: number): Promise<`0x${string}`> {
    const client = this.getPublicClient();
    return client.readContract({
      address: this.registry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "ownerOf",
      args: [BigInt(agentId)],
    }) as Promise<`0x${string}`>;
  }
}
