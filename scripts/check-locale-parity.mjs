#!/usr/bin/env node
// Locale-parity gate (ADR-003, DEV-PHASES-PLAN W1): every key present in
// en.json must exist in all other locales, and no locale may carry keys that
// en.json lacks. Replaces the manual 10-locale checklist with a CI job.
//
// Usage: node scripts/check-locale-parity.mjs
// Exit 0 = parity holds; exit 1 = report printed, parity broken.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = new URL('../src/locales', import.meta.url).pathname;
const REFERENCE = 'en.json';

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
if (!files.includes(REFERENCE)) {
  console.error(`✗ reference locale ${REFERENCE} not found in ${LOCALES_DIR}`);
  process.exit(1);
}

const keySets = new Map(
  files.map((f) => {
    const parsed = JSON.parse(readFileSync(join(LOCALES_DIR, f), 'utf8'));
    return [f, new Set(flattenKeys(parsed))];
  }),
);

const reference = keySets.get(REFERENCE);
let broken = false;

for (const [file, keys] of keySets) {
  if (file === REFERENCE) continue;
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    broken = true;
    console.error(`✗ ${file}: ${missing.length} missing, ${extra.length} extra vs ${REFERENCE}`);
    for (const k of missing) console.error(`    missing: ${k}`);
    for (const k of extra) console.error(`    extra:   ${k}`);
  }
}

if (broken) {
  console.error(
    '\nLocale parity broken (ADR-003): every key added to en.json must land in all locales in the same MR.',
  );
  process.exit(1);
}
console.log(`✓ locale parity holds across ${files.length} locales (${reference.size} keys each)`);
