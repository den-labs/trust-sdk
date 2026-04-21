# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-04-21

### Fixed

- Publishing: previously-published `@denlabs/trust-sdk@0.2.0` and `@denlabs/ayni-sdk@0.1.1`
  carried unresolved `workspace:*` protocol in their `dependencies`, which breaks
  installs outside this monorepo. Republishing with resolved versions.

### Changed

- `@denlabs/ayni-sdk`: 0.1.1 → 0.1.2 (republish with resolved `@denlabs/trust-client-core@0.1.0`)
- `@denlabs/trust-sdk`: 0.2.1 → publish (first publish with resolved deps)

### Added

- `scripts/check-pack.mjs` + `pnpm check:pack` — preflight that packs each
  publishable package and fails if any unresolved `workspace:*` protocol remains
  in the packed `package.json`. Run before every `pnpm publish`.

## [0.2.1] - 2026-03-14

### Fixed

- @denlabs/ayni-sdk: correct base URL (ayni.vercel.app -> ayni-alpha.vercel.app)

### Added

- Full smoke test scripts for both SDKs (test-all-endpoints.mjs)
- 100% statement coverage in trust-client-core (64 tests)

## [0.2.0] - 2026-03-13

### Added

- Multichain SDK monorepo refactor (#1)
- @denlabs/ayni-sdk package for Ayni/Avalanche (43114, 43113)
- @denlabs/trust-client-core shared base (client, x402, errors, types)
- Coverage configuration with @vitest/coverage-v8 (#2)
- test:coverage script

### Changed

- @denlabs/trust-sdk now extends TrustClient from core (thin wrapper)
- Monorepo structure with pnpm workspaces

## [0.1.0] - 2026-03-13

### Added

- Initial @denlabs/trust-sdk -- TypeScript SDK for DenScope Reputation API
- 5 API methods: getAgent, getScore, getSignals, getEvents, search
- x402 micropayment support (EIP-712 signing)
- API key authentication (Bearer / X-API-Key)
- Error hierarchy: TrustClientError, PaymentRequiredError, AuthenticationError
- Runnable examples (get-score, get-score-x402)

[0.2.0]: https://github.com/den-labs/trust-sdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/den-labs/trust-sdk/releases/tag/v0.1.0
