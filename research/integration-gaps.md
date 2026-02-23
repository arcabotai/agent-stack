# Integration Gaps Analysis

## What Exists (as of Feb 2026)

### x402 ↔ ERC-8004
- ERC-8004 spec has `x402Support` field — just a boolean flag
- No lib connects them: no "pay this agent's wallet automatically" flow
- No "verify agent identity before paying" flow
- You can manually get `getAgentWallet()` + then pay, but no SDK for this

### x402 ↔ MCP  
- MCP has "URL elicitation" for external flows (could be used for payment)
- No library wraps MCP tools with x402 middleware
- cdp-ai-agent-kit and similar tools exist but don't combine MCP + x402

### ERC-8004 ↔ MCP
- ERC-8004 spec explicitly includes MCP endpoint in services array
- No library: resolves ERC-8004 global ID → MCP endpoint → connects MCP client
- No library: creates MCP server that auto-exposes agent's ERC-8004 profile as resource

## The Gap This SDK Fills

The full stack flow nobody has built:
```
Agent A wants to use Agent B's data service:

1. A looks up B by name/capability (via ERC-8004 on-chain)
2. A verifies B's identity (on-chain registration check)
3. A discovers B's MCP endpoint (from registration services array)
4. A sees B requires x402 payment (from registration x402Support flag)
5. A gets B's payment wallet (from getAgentWallet() on-chain)
6. A connects to B's MCP endpoint with pre-paid x402 header
7. B's MCP server validates payment, serves the tool/resource
8. B posts payment receipt to reputation registry (optional)
```

## Closest Existing Projects
- **cdp-agentkit**: Coinbase's AI agent toolkit — has x402 + MCP but NOT ERC-8004
- **Watchy**: x402-protected audit service — uses ERC-8004 agent ID in request but doesn't verify identity
- **AgentKit**: Has wallet + MCP tools but no identity layer
- **Lit Protocol**: TEE + MCP but no x402

## SDK Opportunity
First package to provide the full glue layer between all three. Clean API surface, zero-config, modular.

## Technical Decisions for SDK
1. Use `viem` (not ethers) — matches x402/evm dependency, more modern
2. Target Node 18+ — matches @modelcontextprotocol/sdk
3. ESM + CJS — for broad compatibility
4. No bundled private keys — accept account/signer objects from caller
5. Registry address as constant with override option
6. CAIP-2 format for chain IDs (`eip155:8453`)
