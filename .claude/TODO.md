## Session Plan — 2026-03-13 | Multichain SDK Refactor

### Current State
- ✅ **Completed**: trust-sdk v0.1.0 working for DenScope (Celo) — 7 commits on main
- 🚧 **In Progress**: Unstaged changes in `client.ts` and `types.ts` (minor edits)
- ⚠️ **Blockers**: None — APIs confirmed 100% shape-compatible
- 🔧 **Tech Debt**: DenScope-specific naming baked into core logic (errors, types)

### Project Context
- **Type**: TypeScript SDK library (npm package)
- **Stack**: TypeScript, tsup (dual ESM/CJS), vitest, viem (optional peer)
- **Testing**: vitest — 2 test files (client + x402)

### Key Finding

Ayni API v1 and DenScope API v1 return **identical response shapes**:
- `/score` → ScoreResponse ✓ identical
- `/signals` → SignalsResponse ✓ identical
- `/agent/{id}` → AgentProfileResponse ✓ identical
- `/events` → EventsResponse ✓ identical
- `/search` → SearchResponse ✓ identical

This means the core client logic, types, x402 flow, and error handling can be shared 1:1.

### Architecture Target

```
packages/
├── trust-client-core/          ← NEW: shared logic
│   ├── src/
│   │   ├── index.ts            ← barrel export
│   │   ├── client.ts           ← TrustClient base class (generic)
│   │   ├── types.ts            ← shared types (rename DenScope* → generic)
│   │   ├── errors.ts           ← TrustClientError (rename from DenScopeError)
│   │   ├── x402.ts             ← unchanged (already chain-agnostic)
│   │   └── constants.ts        ← API_PREFIX, EIP3009_TYPES, SIGNATURE_VALIDITY
│   ├── __tests__/
│   ├── package.json            ← @denlabs/trust-client-core
│   └── tsup.config.ts
│
├── trust-sdk/                  ← REFACTOR: thin wrapper
│   ├── src/
│   │   ├── index.ts            ← re-export DenScope + core types
│   │   └── client.ts           ← DenScope extends TrustClient (baseUrl, chains)
│   ├── __tests__/
│   ├── package.json            ← @denlabs/trust-sdk, depends on core
│   └── tsup.config.ts
│
└── ayni-sdk/                   ← NEW: thin wrapper
    ├── src/
    │   ├── index.ts            ← export Ayni + core types
    │   └── client.ts           ← Ayni extends TrustClient (baseUrl, chains)
    ├── __tests__/
    ├── package.json            ← @denlabs/ayni-sdk, depends on core
    └── tsup.config.ts
```

### Next Steps (Prioritized)

#### Step 1: Extract `@denlabs/trust-client-core` — S

- [ ] Create `packages/trust-client-core/` with package.json, tsup, tsconfig, vitest
- [ ] Move `errors.ts` → rename `DenScopeError` → `TrustClientError` (keep `DenScopeError` as alias for backward compat in trust-sdk)
- [ ] Move `x402.ts` → as-is (already generic)
- [ ] Move `constants.ts` → keep `API_PREFIX`, `EIP3009_TYPES`, `SIGNATURE_VALIDITY_SECONDS`. Remove `DEFAULT_BASE_URL` (each wrapper defines its own)
- [ ] Move `types.ts` → rename `DenScopeConfig` → `TrustClientConfig`, `DenScopeFetch` → `TrustClientFetch`
- [ ] Create `client.ts` → `TrustClient` base class (abstract or with `baseUrl` constructor param). All 5 methods + `request()` + `handleResponse()` + timeout logic
- [ ] Barrel export from `index.ts`
- [ ] `pnpm build` passes
- **Acceptance**: core builds, exports all shared types/classes, zero runtime deps

#### Step 2: Refactor `@denlabs/trust-sdk` as thin wrapper — S

- [ ] Move existing repo content to `packages/trust-sdk/`
- [ ] Add dependency on `@denlabs/trust-client-core` (workspace link)
- [ ] `client.ts` → `DenScope extends TrustClient` with `DEFAULT_BASE_URL = 'https://denscope.vercel.app'`
- [ ] `index.ts` → re-export `DenScope`, re-export all types from core, keep `DenScopeError` alias
- [ ] Move existing tests, update imports
- [ ] `pnpm build && pnpm test` passes — all existing tests still green
- **Acceptance**: zero breaking changes for current consumers (`import { DenScope } from '@denlabs/trust-sdk'` works identically)

#### Step 3: Create `@denlabs/ayni-sdk` — S

- [ ] Create `packages/ayni-sdk/` with package.json (`@denlabs/ayni-sdk`), tsup, tsconfig
- [ ] `client.ts` → `Ayni extends TrustClient` with `DEFAULT_BASE_URL = 'https://ayni.vercel.app'`
- [ ] `index.ts` → export `Ayni`, re-export core types, export `AyniError` alias
- [ ] Write tests mirroring trust-sdk tests (s/DenScope/Ayni, s/denscope.vercel.app/ayni.vercel.app, s/ds_/ay_/)
- [ ] `pnpm build && pnpm test` passes
- **Acceptance**: `import { Ayni } from '@denlabs/ayni-sdk'` works with identical API surface

#### Step 4: Workspace setup (pnpm workspaces) — S

- [ ] Add `pnpm-workspace.yaml` at trust-sdk root: `packages: ["packages/*"]`
- [ ] Root `package.json` with workspace scripts (`build:all`, `test:all`)
- [ ] Verify `pnpm -r build && pnpm -r test` passes across all 3 packages
- **Acceptance**: single `pnpm -r build` builds everything, tests all green

#### Step 5: Documentation & examples — S

- [ ] Update trust-sdk README (no breaking changes, mention core)
- [ ] Create ayni-sdk README (mirror structure, Avalanche chains, `ay_` keys)
- [ ] Add ayni examples (`examples/get-score.mjs`, `examples/get-score-x402.mjs`)
- [ ] Update CLAUDE.md with new monorepo structure
- **Acceptance**: READMEs accurate, examples runnable

### Technical Decisions

- **Monorepo in same repo (trust-sdk)**: Keep all 3 packages in the existing `den-labs/trust-sdk` repo using pnpm workspaces. No new repos needed.
- **Base class, not factory**: `TrustClient` is a base class that wrappers extend with their `baseUrl`. Simpler than factory pattern, clear inheritance.
- **Backward compatibility**: `DenScopeError` stays as type alias in trust-sdk. Import paths unchanged. Zero breaking changes.
- **Types are shared**: Since API shapes are identical, all response types live in core. No per-wrapper types needed.
- **Error naming**: Core uses `TrustClientError`. Each wrapper re-exports with its own alias (`DenScopeError`, `AyniError`).

### Notes for Next Session
- Unstaged changes in current `client.ts` and `types.ts` — review/commit or discard before starting refactor
- ayni deploy URL needs confirmation (currently assumed `ayni.vercel.app`)
- Consider npm publish strategy: publish core first, then wrappers
