# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
