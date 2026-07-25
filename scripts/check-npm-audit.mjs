#!/usr/bin/env node
/**
 * npm-audit gate with an explicit, expiring allowlist.
 *
 * Replaces a bare `npm audit --audit-level=high` in CI. `npm audit` has no
 * ignore mechanism of its own, which is a problem: when an advisory has no
 * patched version reachable from our tree, the only ways to make it green are to
 * force an incompatible major (which broke `minimatch@3` — see
 * `.npm-audit-allowlist.json`) or to stop running the gate. Neither is a
 * decision anyone should make silently, so this script makes accepting a finding
 * an explicit, reviewed, *dated* entry instead — the same shape as
 * `.retireignore.json`, `.trivyignore` and `LICENSES.allowlist`.
 *
 * It fails on:
 *   - any high/critical ROOT advisory that is not allowlisted;
 *   - any allowlist entry whose `expires` date has passed (forces a re-review
 *     rather than letting an acceptance become permanent by neglect).
 *
 * "Root advisory" matters: npm reports every package that *transitively* depends
 * on a vulnerable leaf, so one unpatched leaf can look like 33 findings. Only the
 * `via` entries that are advisory objects are real; the rest are consequences.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWLIST_PATH = new URL('../.npm-audit-allowlist.json', import.meta.url);
const BLOCKING = new Set(['high', 'critical']);

/** `npm audit` exits non-zero when it finds anything, so the throw carries the JSON. */
function runAudit() {
  try {
    return execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (error.stdout) {
      return error.stdout;
    }
    throw error;
  }
}

const audit = JSON.parse(runAudit());
const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));

/** Advisory id → the packages that cite it, for a readable failure message. */
const advisories = new Map();
for (const [name, info] of Object.entries(audit.vulnerabilities ?? {})) {
  if (!BLOCKING.has(info.severity)) {
    continue;
  }
  for (const via of info.via ?? []) {
    // A string `via` means "depends on something vulnerable" — a consequence of
    // another advisory, not a finding of its own.
    if (typeof via !== 'object') {
      continue;
    }
    const id = via.url?.split('/').pop() ?? `npm-${via.source}`;
    const entry = advisories.get(id) ?? { title: via.title, severity: via.severity, packages: new Set() };
    entry.packages.add(name);
    advisories.set(id, entry);
  }
}

const allowed = new Map(allowlist.map((entry) => [entry.id, entry]));
const today = new Date().toISOString().slice(0, 10);

const unlisted = [...advisories].filter(([id]) => !allowed.has(id));
const expired = allowlist.filter((entry) => entry.expires < today && advisories.has(entry.id));
const stale = allowlist.filter((entry) => !advisories.has(entry.id));

for (const [id, entry] of advisories) {
  if (allowed.has(id)) {
    console.log(`• accepted: ${id} (${entry.severity}) — ${allowed.get(id).reason}`);
    console.log(`  expires ${allowed.get(id).expires}; ${entry.packages.size} package(s) report it transitively`);
  }
}
for (const entry of stale) {
  console.log(`• allowlist entry no longer needed (advisory gone): ${entry.id} — remove it from .npm-audit-allowlist.json`);
}

if (unlisted.length === 0 && expired.length === 0) {
  console.log(`✓ npm audit: no unaccepted high/critical advisories (${advisories.size} accepted)`);
  process.exit(0);
}

for (const [id, entry] of unlisted) {
  console.error(`✗ ${id} (${entry.severity}) — ${entry.title}`);
  console.error(`  reported via: ${[...entry.packages].slice(0, 6).join(', ')}`);
}
for (const entry of expired) {
  console.error(`✗ ${entry.id}: acceptance expired ${entry.expires} — re-review and either fix or extend with a reason`);
}
console.error(
  '\nFix the dependency if a compatible patched version exists. Only if none does,' +
    '\nadd an entry to .npm-audit-allowlist.json with a reason and an expiry date.',
);
process.exit(1);
