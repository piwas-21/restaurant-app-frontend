#!/usr/bin/env node
/**
 * Gate: no file in the tree may hand a human or a build a provider box-hostname URL (#559).
 *
 * WHY. A Netcup box's reverse-DNS name (`*.megasrv.de`, `*.happysrv.de`) lives in the
 * PROVIDER's zone. We cannot answer an ACME challenge there, so Caddy never holds a
 * certificate for that SNI and aborts the handshake with `tlsv1 alert internal error`.
 * Every https:// URL built on such a name is therefore permanently dead — not "dead until
 * DNS propagates", dead for good. Measured in deploy #146 / #147.
 *
 * This repo carried one: `build-image.yml` used the box hostname as the FALLBACK for
 * `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_IMAGE_BASE_URL` when `vars.STAGING_PUBLIC_URL` is
 * unset. Those values are baked into the bundle at BUILD time, so deleting the repo
 * variable would have published a staging image that cannot reach any backend and cannot
 * be repaired without a rebuild — and CI would have stayed green throughout. The fallback
 * is gone; this gate is what stops the next one.
 *
 * SCOPE is the whole working tree, not a directory: the hazard is a string, and it has
 * already appeared in a workflow, in compose defaults, in `.env` templates and in runbook
 * prose across two repos. Mirrors `tests/staging-domain.sh` in the deploy repo, including
 * its rule about prose: naming the trap in a comment is wanted, so only a URL (a scheme
 * followed by such a host) fails. That is the thing a human pastes or a build bakes in.
 *
 * The tree is walked directly instead of shelling out to `git ls-files`, for the two
 * reasons `scripts/lib/ratchet.mjs` gives: Sonar S4036 (resolving `git` through `PATH`),
 * and untracked files — a brand-new file carrying the dead URL is exactly what this must
 * catch, and `git ls-files` would not list it until it was staged.
 *
 * FAIL-CLOSED. A run that scanned no files is a FAILURE, and the success line prints what
 * it examined so a green run is falsifiable.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Provider reverse-DNS zones we can never obtain a certificate in. */
const ZONES = ['megasrv', 'happysrv'];

/**
 * A URL, not a mention. The scheme is assembled from two pieces so this file's own prose
 * and this very pattern cannot trip the gate they define.
 */
const OFFENDER = new RegExp(String.raw`\bhttps?:` + `//` + String.raw`[a-z0-9.-]+\.(?:${ZONES.join('|')})\.de`, 'i');

/** Dependencies, build output and test artifacts: not ours to police, and enormous. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'coverage',
  'playwright-report',
  'test-results',
  'blob-report',
  '.turbo',
  'dist',
  'out',
]);

/** Skip what cannot usefully hold a pasteable URL: images, fonts, archives, video. */
const SKIP_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.mp4',
  '.webm',
]);

const MAX_BYTES = 2 * 1024 * 1024;

/** Every candidate file under `dir`, as repo-relative POSIX paths. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && !SKIP_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.relative(ROOT, path.join(dir, entry.name)).split(path.sep).join('/'));
    }
  }
  return out;
}

const hits = [];
let scanned = 0;

for (const rel of walk(ROOT)) {
  const abs = path.join(ROOT, rel);
  if (statSync(abs).size > MAX_BYTES) continue;

  const buf = readFileSync(abs);
  if (buf.includes(0)) continue; // binary
  scanned += 1;

  buf
    .toString('utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = OFFENDER.exec(line);
      if (m) hits.push({ rel, line: i + 1, url: m[0] });
    });
}

if (scanned === 0) {
  console.error('check-provider-host-urls: scanned NOTHING — the gate is broken, not the tree.');
  process.exit(1);
}

if (hits.length > 0) {
  console.error(`check-provider-host-urls: ${hits.length} URL(s) on a provider box hostname:\n`);
  for (const h of hits) console.error(`  ${h.rel}:${h.line}  ${h.url}`);
  console.error(
    [
      '',
      "Such a host is in the provider's reverse-DNS zone: no ACME challenge can be answered",
      'there, so it can never serve TLS and every request to it dies in the handshake.',
      'Use the name the box really serves (staging: the STAGING_PUBLIC_URL repo variable),',
      'or state the hostname in prose without a scheme if you are explaining the trap.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  `check-provider-host-urls: ${scanned} text file(s) scanned, none offers an https:// URL on ${ZONES.map(
    (z) => `*.${z}.de`,
  ).join(' / ')}.`,
);
