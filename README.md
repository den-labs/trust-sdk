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
