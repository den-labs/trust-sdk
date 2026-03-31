# DenLabs Trust SDK

<!-- denlabs-meta
name: trust-sdk
type: monorepo
surface: public-sdk
status: public
owner: Wolfcito
pm: pnpm
repo: https://github.com/den-labs/trust-sdk
url: https://github.com/den-labs/trust-sdk
scripts: [build, test, typecheck]
-->

> **DenLabs Lab** · Multichain SDK
> TypeScript SDKs for querying ERC-8004 agent trust scores — API key or x402 micropayments.

## Packages

| Package | Chain | npm | Install |
|---------|-------|-----|---------|
| `@denlabs/trust-sdk` | Celo, SKALE Base | [![npm](https://img.shields.io/npm/v/@denlabs/trust-sdk)](https://www.npmjs.com/package/@denlabs/trust-sdk) | `pnpm add @denlabs/trust-sdk` |
| `@denlabs/ayni-sdk` | Avalanche | [![npm](https://img.shields.io/npm/v/@denlabs/ayni-sdk)](https://www.npmjs.com/package/@denlabs/ayni-sdk) | `pnpm add @denlabs/ayni-sdk` |

Both SDKs share `@denlabs/trust-client-core` (base client, x402, errors, types). For x402 payment mode, also install `viem`:

```bash
pnpm add viem
```

## Quick Start

### DenScope (Celo, SKALE Base)

```typescript
import { DenScope } from '@denlabs/trust-sdk'

const ds = new DenScope({ apiKey: 'ds_...' })
const { score } = await ds.getScore(42220, 5)
console.log(score.value, score.confidence) // 72 "high"
```

### Ayni (Avalanche)

```typescript
import { Ayni } from '@denlabs/ayni-sdk'

const ayni = new Ayni({ apiKey: 'ds_...' })
const { score } = await ayni.getScore(43114, 1)
console.log(score.value, score.confidence)
```

### Trust Evaluation

Run contextual trust evaluations with configurable presets:

```typescript
import { DenScope } from '@denlabs/trust-sdk'

const ds = new DenScope({ apiKey: 'ds_...' })
const { evaluation } = await ds.evaluate(42220, 5, { preset: 'default_safety' })

console.log(evaluation.recommended_action) // "allow" | "review" | "limit"
console.log(evaluation.trust_band)         // "high" | "medium" | "low" | "insufficient_signal"
console.log(evaluation.rationale)          // Human-readable explanation
```

Available presets: `default_safety`, `agent_to_agent`, `defi_counterparty`.

### x402 Payment Mode

Agents with wallets can pay per-query instead of using API keys:

```typescript
import { DenScope } from '@denlabs/trust-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')
const ds = new DenScope({ account })

// Automatically handles 402 -> sign -> retry
const { score } = await ds.getScore(42220, 5)   // $0.001
const { signals } = await ds.getSignals(42220, 5) // $0.0005
```

x402 is supported on `/score` and `/signals` endpoints. The SDK handles the full 402 flow automatically: receives payment requirement, signs EIP-712 authorization, and retries with the X-PAYMENT header.

## Supported Chains

| SDK | Chain | Chain ID | Oracle URL |
|-----|-------|----------|------------|
| `@denlabs/trust-sdk` | Celo Mainnet | 42220 | denscope.vercel.app |
| `@denlabs/trust-sdk` | Celo Sepolia | 11142220 | denscope.vercel.app |
| `@denlabs/trust-sdk` | SKALE Base | 1187947933 | denscope.vercel.app |
| `@denlabs/ayni-sdk` | Avalanche C-Chain | 43114 | ayni-alpha.vercel.app |
| `@denlabs/ayni-sdk` | Avalanche Fuji | 43113 | ayni-alpha.vercel.app |

## API Reference

Both SDKs expose the same 6 methods:

### Constructor

```typescript
// DenScope (Celo, SKALE Base)
const client = new DenScope({ apiKey: 'ds_...' })
const client = new DenScope({ account, baseUrl: '...' })

// Ayni (Avalanche)
const client = new Ayni({ apiKey: 'ds_...' })
const client = new Ayni({ account, baseUrl: '...' })
```

| Config | Required | Description |
|--------|----------|-------------|
| `apiKey` | One of | API key (`ds_...` prefix) |
| `account` | One of | viem account with `signTypedData` (for x402) |
| `baseUrl` | No | Override API URL |
| `timeoutMs` | No | Request timeout in milliseconds |
| `fetch` | No | Custom fetch implementation |

### Methods

| Method | Description | x402 |
|--------|-------------|------|
| `getAgent(chainId, agentId)` | Agent profile, owner, metadata, feedback counts | No |
| `getScore(chainId, agentId)` | Trust score (0-100) with confidence and breakdown | Yes |
| `getSignals(chainId, agentId, opts?)` | Risk signals/incidents | Yes |
| `getEvents(chainId, agentId, opts?)` | On-chain event history | No |
| `search(opts?)` | Search agents by ID, owner, or chain | No |
| `evaluate(chainId, agentId, opts)` | Contextual trust evaluation with presets | Yes |

### Error Types

```typescript
import { DenScopeError, AuthenticationError, PaymentRequiredError } from '@denlabs/trust-sdk'
// or
import { AyniError, AuthenticationError, PaymentRequiredError } from '@denlabs/ayni-sdk'

try {
  await client.getScore(42220, 5)
} catch (e) {
  if (e instanceof AuthenticationError) {
    // 401 or 403 — invalid/disabled API key
  } else if (e instanceof PaymentRequiredError) {
    // 402 — no x402 account configured
  } else if (e instanceof DenScopeError) {
    // Other API error (404, 429, 500)
    console.log(e.status, e.body)
  }
}
```

## Runnable Examples

After cloning this repository:

```bash
pnpm install && pnpm build

# DenScope (Celo, SKALE Base)
DENSCOPE_API_KEY=ds_... node packages/trust-sdk/examples/get-score.mjs
DENSCOPE_API_KEY=ds_... node packages/trust-sdk/examples/test-all-endpoints.mjs

# Ayni (Avalanche)
AYNI_API_KEY=ds_... node packages/ayni-sdk/examples/get-score.mjs
AYNI_API_KEY=ds_... node packages/ayni-sdk/examples/test-all-endpoints.mjs
```

## Monorepo Structure

```
packages/
  trust-client-core/   @denlabs/trust-client-core — shared base client, x402, errors, types
  trust-sdk/           @denlabs/trust-sdk — DenScope wrapper (Celo, SKALE Base)
  ayni-sdk/            @denlabs/ayni-sdk — Ayni wrapper (Avalanche)
```

Adding a new chain = new thin wrapper package (~20 lines of code).

## Requirements

- Node.js 18+ (uses native `fetch`)
- viem 2.x (optional, only for x402 mode)

## License

MIT
