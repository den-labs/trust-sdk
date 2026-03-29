# CLAUDE.md — DenLabs Trust SDK Monorepo

## What This Is

Multichain trust oracle SDK monorepo. Shared core + per-chain thin wrappers for querying ERC-8004 agent trust scores via API key or x402 micropayments.

## Monorepo Structure

```
packages/
├── trust-client-core/    @denlabs/trust-client-core — shared base client, x402, errors, types
├── trust-sdk/            @denlabs/trust-sdk — DenScope wrapper (Celo: 42220, 11142220; SKALE Base: 1187947933)
└── ayni-sdk/             @denlabs/ayni-sdk — Ayni wrapper (Avalanche: 43114, 43113)
```

## Tech Stack

- TypeScript, tsup (dual CJS/ESM build), pnpm workspaces
- vitest for testing
- viem as optional peer dep (x402 signing only)

## Commands

```bash
pnpm build       # Build all packages (core first, then wrappers in parallel)
pnpm test        # Run all tests across workspace
pnpm typecheck   # Type-check all packages
```

## Package Details

### trust-client-core (shared)
- `src/client.ts` — `TrustClient` base class (5 methods + x402 retry + timeout/abort)
- `src/types.ts` — All shared response types (AgentProfile, TrustScore, Signal, etc.)
- `src/errors.ts` — `TrustClientError`, `PaymentRequiredError`, `AuthenticationError`
- `src/x402.ts` — Decode 402, sign EIP-712, build X-PAYMENT header
- `src/constants.ts` — API prefix, EIP-3009 types, signature validity

### trust-sdk (DenScope — Celo, SKALE Base)
- `src/client.ts` — `DenScope extends TrustClient` with `baseUrl = denscope.vercel.app`
- `src/index.ts` — Re-exports `DenScope` + backward-compatible `DenScopeError` alias

### ayni-sdk (Ayni — Avalanche)
- `src/client.ts` — `Ayni extends TrustClient` with `baseUrl = ayni.vercel.app`
- `src/index.ts` — Re-exports `Ayni` + `AyniError` alias

## Key Conventions

- No runtime dependencies — only `fetch` (Node 18+)
- viem is an optional peer dep, only needed for x402
- EIP-712 domain is extracted from 402 response, never hardcoded
- x402 wire format: amount/validAfter/validBefore always strings
- Module resolution: `bundler` (tsup handles output)
- Adding a new chain = new thin wrapper package (~20 lines of code)

## Adding a New Oracle

1. Create `packages/<name>-sdk/` copying ayni-sdk structure
2. Change `DEFAULT_BASE_URL` and class name
3. Add tests mirroring the pattern
4. Add to workspace — `pnpm install` auto-links
