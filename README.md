# @denlabs/trust-sdk

TypeScript SDK for the [DenScope Reputation API](https://denscope.vercel.app/docs/api) — query ERC-8004 agent trust scores with API key or x402 micropayments.

## Install

```bash
pnpm add @denlabs/trust-sdk
```

For x402 payment mode, also install viem:

```bash
pnpm add viem
```

## Quick Start

### API Key Mode

```typescript
import { DenScope } from '@denlabs/trust-sdk'

const ds = new DenScope({ apiKey: 'ds_...' })

// Get agent trust score
const { score } = await ds.getScore(42220, 5)
console.log(score.value, score.confidence) // 72 "high"

// Get agent profile
const { agent } = await ds.getAgent(42220, 5)

// Get signals/incidents
const { signals } = await ds.getSignals(42220, 5, { status: 'open' })

// Get events
const { events } = await ds.getEvents(42220, 5, { limit: 10 })

// Search agents
const { agents } = await ds.search({ q: '0xabc', chainId: 42220 })
```

### x402 Payment Mode

Agents with wallets can pay per-query instead of using API keys:

```typescript
import { DenScope } from '@denlabs/trust-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')
const ds = new DenScope({ account })

// Automatically handles 402 → sign → retry
const { score } = await ds.getScore(42220, 5)   // $0.001
const { signals } = await ds.getSignals(42220, 5) // $0.0005
```

x402 is supported on `/score` and `/signals` endpoints. The SDK handles the full 402 flow automatically: receives payment requirement, signs EIP-712 authorization, and retries with the X-PAYMENT header.

## Runnable Examples (local repo)

After cloning this repository:

```bash
pnpm install
pnpm example:get-score      # requires DENSCOPE_API_KEY=ds_...
pnpm example:get-score:x402 # requires DENSCOPE_PRIVATE_KEY=0x...
```

Optional env vars for both examples:
- `DENSCOPE_CHAIN_ID` (default: `42220`)
- `DENSCOPE_AGENT_ID` (default: `5`)

## DX Checklist (Production Readiness)

Use this checklist to make the SDK easier to adopt and safer to integrate in real apps.

### High priority (next sprint)

- Add request timeout / AbortSignal support
- Allow custom/injected `fetch` (runtime compatibility + testing)
- Add a short “common errors and recovery” section (401/402/429/404)
- Publish a tagged release + changelog

### Medium priority

- Add conservative retry/backoff for `429` / `5xx` responses
- Improve x402 payment method selection (not only first accepted method)
- Add more runnable examples (search -> agent -> score workflow)
- Document compatibility matrix (Node versions / viem versions)

### Nice to have

- Runtime response validation/guards for public SDK hardening
- Helper utilities (or docs) for mapping score/confidence to semantic trust states
- CI badges / npm version badge / release notes links

### DX success criteria

A new developer should be able to:

1. Install the SDK
2. Run an example successfully
3. Understand a common error and recover
4. Integrate `getScore`/`getSignals` in under 30 minutes

## API Reference

### `new DenScope(config)`

| Config | Required | Description |
|--------|----------|-------------|
| `apiKey` | One of | DenScope API key (`ds_...` prefix) |
| `account` | One of | viem account with `signTypedData` (for x402) |
| `baseUrl` | No | Override API URL (default: `https://denscope.vercel.app`) |

### Methods

#### `getAgent(chainId, agentId): Promise<AgentProfileResponse>`

Get agent profile including owner, metadata, feedback counts, and claim status.

#### `getScore(chainId, agentId): Promise<ScoreResponse>`

Get trust score (0-100) with confidence level, breakdown, and stats. Supports x402 payment.

#### `getSignals(chainId, agentId, options?): Promise<SignalsResponse>`

Get agent incidents/signals. Supports x402 payment.

Options: `{ status?: 'open' | 'resolved' | 'all' }`

#### `getEvents(chainId, agentId, options?): Promise<EventsResponse>`

Get agent on-chain events with pagination.

Options: `{ limit?: number, offset?: number, kind?: string }`

#### `search(options?): Promise<SearchResponse>`

Search agents by ID or owner address.

Options: `{ q?: string, chainId?: number, limit?: number }`

### Error Types

```typescript
import { DenScopeError, AuthenticationError, PaymentRequiredError } from '@denlabs/trust-sdk'

try {
  await ds.getScore(42220, 5)
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

## Supported Chains

| Chain | Chain ID |
|-------|----------|
| Celo Mainnet | 42220 |
| Celo Sepolia | 11142220 |

## Requirements

- Node.js 18+ (uses native `fetch`)
- viem 2.x (optional, only for x402 mode)

## License

MIT
