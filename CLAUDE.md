# CLAUDE.md — @denlabs/trust-sdk

## What This Is

Zero-dependency TypeScript SDK wrapping the DenScope Reputation API (5 endpoints). Supports API key and x402 micropayment authentication.

## Tech Stack

- TypeScript, tsup (dual CJS/ESM build)
- vitest for testing
- viem as optional peer dep (x402 signing only)

## Commands

```bash
pnpm build       # Build ESM + CJS + .d.ts to dist/
pnpm typecheck   # Type-check without emitting
pnpm test        # Run vitest
```

## File Structure

- `src/types.ts` — Response types matching DenScope API v1
- `src/constants.ts` — Base URL, API prefix, EIP-3009 types
- `src/errors.ts` — DenScopeError, PaymentRequiredError, AuthenticationError
- `src/x402.ts` — Decode 402, sign EIP-712, build X-PAYMENT header
- `src/client.ts` — DenScope class (5 methods + request with 402 retry)
- `src/index.ts` — Barrel export

## Key Conventions

- No runtime dependencies — only `fetch` (Node 18+)
- viem is an optional peer dep, only needed for x402
- EIP-712 domain is extracted from 402 response, never hardcoded
- x402 wire format: amount/validAfter/validBefore always strings
- Module resolution: `bundler` (tsup handles output)
