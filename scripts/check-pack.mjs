#!/usr/bin/env node
// Preflight check before publishing. Runs `pnpm pack` on each package that is
// not private, and verifies the packed package.json has no unresolved
// `workspace:*` protocol — which would break installs outside the monorepo.
//
// Exit 0 only when all packages pack cleanly.
// Exit 1 with a readable diff otherwise.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const TMP = tmpdir();

const failures = [];

function pack(pkgDir, pkgJson) {
  const name = pkgJson.name.replace('@', '').replace('/', '-');
  const tarball = join(TMP, `${name}-${pkgJson.version}.tgz`);
  execSync(`pnpm pack --pack-destination=${TMP}`, { cwd: pkgDir, stdio: 'pipe' });
  const packedJson = JSON.parse(
    execSync(`tar -xOzf ${tarball} package/package.json`, { encoding: 'utf8' }),
  );
  rmSync(tarball, { force: true });
  return packedJson;
}

function hasWorkspaceProtocol(deps = {}) {
  return Object.entries(deps).filter(([, v]) => typeof v === 'string' && v.startsWith('workspace:'));
}

for (const entry of readdirSync(PACKAGES_DIR)) {
  const pkgDir = join(PACKAGES_DIR, entry);
  let pkgJson;
  try {
    pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (pkgJson.private) continue;

  console.log(`→ ${pkgJson.name}@${pkgJson.version}`);

  let packed;
  try {
    packed = pack(pkgDir, pkgJson);
  } catch (err) {
    failures.push(`${pkgJson.name}: pack failed — ${err.message.split('\n')[0]}`);
    continue;
  }

  const leaks = [
    ...hasWorkspaceProtocol(packed.dependencies),
    ...hasWorkspaceProtocol(packed.peerDependencies),
    ...hasWorkspaceProtocol(packed.optionalDependencies),
  ];

  if (leaks.length > 0) {
    failures.push(
      `${pkgJson.name}@${packed.version}: unresolved workspace protocol → ${leaks
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    );
  } else {
    console.log(`  ✓ dependencies resolved: ${JSON.stringify(packed.dependencies ?? {})}`);
  }
}

if (failures.length > 0) {
  console.error('\n✗ check:pack failed:\n');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nHint: run `pnpm install` in the monorepo root, then retry.');
  process.exit(1);
}

console.log('\n✓ All publishable packages pack cleanly.');
