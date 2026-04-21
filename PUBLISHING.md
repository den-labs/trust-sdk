# Publishing

Publishable packages in this monorepo:

| Package                         | Path                              | Latest on npm |
| ------------------------------- | --------------------------------- | ------------- |
| `@denlabs/trust-client-core`    | `packages/trust-client-core`      | 0.1.0         |
| `@denlabs/trust-sdk`            | `packages/trust-sdk`              | 0.2.0         |
| `@denlabs/ayni-sdk`             | `packages/ayni-sdk`               | 0.1.1         |
| `@denlabs/trust-mcp-server`     | `packages/mcp-server`             | 0.1.0         |

## Publish flow

1. Bump version in the affected `package.json`.
2. Update `CHANGELOG.md` at repo root.
3. From the monorepo root:

   ```bash
   pnpm install         # ensure workspace linkage is fresh
   pnpm test            # all packages green
   pnpm check:pack      # verify NO workspace:* leaks into packed output
   ```

4. Publish from the package directory. With biometric / 2FA accounts, the user
   must run this manually from their terminal — do not try `--otp` or
   `--auth-type=web` flags:

   ```bash
   cd packages/<package>
   pnpm publish --access public
   ```

## Why `check:pack` exists

`@denlabs/trust-sdk@0.2.0` and `@denlabs/ayni-sdk@0.1.1` were published with
`"@denlabs/trust-client-core": "workspace:*"` in their `dependencies`. That
protocol is pnpm-specific and breaks installs outside this monorepo, because
npm/yarn cannot resolve it.

`check:pack` runs `pnpm pack` on every publishable package and scans the packed
`package.json` for any remaining `workspace:*` values. It must pass before every
publish. Root cause of the original leak was packing without first running
`pnpm install` in the workspace (or using an older pnpm that did not rewrite
the protocol).
