#!/usr/bin/env node
/**
 * Assert every committed screenshot baseline is exactly as wide as the viewport that
 * produced it.
 *
 * WHY THIS EXISTS. Baselines are full-page captures, so a horizontal overflow does not
 * clip — it makes the PNG *wider* than the viewport, and the diff still passes because
 * the new baseline is compared against itself. A craft mobile page once shipped at
 * 442px in a 375px viewport and survived three reviews: nobody looks at the pixel
 * dimensions of 56 PNGs, and every automated check downstream compares images to images.
 * This is the one check that compares an image to the *contract*.
 *
 * It is deliberately a plain file check, not a Playwright test: it needs no browser and
 * no server, so it runs on every PR in CI (not only when the Screenshots workflow is
 * dispatched) and catches a bad baseline at the moment it is committed.
 *
 * Width only. Full-page height is content-dependent and legitimately varies.
 *
 * Usage: node scripts/check-baseline-dimensions.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const ROOT = 'e2e/screenshots/__screenshots__';

/** Project directory name -> the viewport width configured for it in
 *  playwright.screenshots.config.ts. Keep these in step with that file's `projects`. */
const EXPECTED_WIDTH = {
  'screenshots-desktop': 1280,
  'screenshots-mobile': 375,
};

/**
 * Read the pixel width from a PNG's IHDR chunk.
 *
 * The PNG signature is 8 bytes, then the IHDR chunk: 4-byte length, 4-byte type,
 * then width as a big-endian uint32 at offset 16. Parsed directly rather than
 * pulled in as a dependency — this must not be able to fail for reasons unrelated
 * to the thing it is checking.
 */
function pngWidth(file) {
  const buf = readFileSync(file);
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG (bad signature)');
  }
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('first chunk is not IHDR');
  }
  return buf.readUInt32BE(16);
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let checked = 0;
const problems = [];

for (const file of walk(ROOT).filter((f) => f.endsWith('.png'))) {
  // .../<template>/<project>/<name>.png — via path.dirname/basename, not split('/'),
  // because join() emits `\` on Windows and the repo ships scripts/setup_hooks.ps1.
  const project = basename(dirname(file));
  const expected = EXPECTED_WIDTH[project];
  if (expected === undefined) {
    problems.push(`${file}\n    unknown project directory '${project}' — add it to EXPECTED_WIDTH or fix the path`);
    continue;
  }
  let width;
  try {
    width = pngWidth(file);
  } catch (err) {
    problems.push(`${file}\n    could not read PNG width: ${err.message}`);
    continue;
  }
  checked += 1;
  if (width !== expected) {
    problems.push(
      `${file}\n    is ${width}px wide, expected ${expected}px — the page overflows its ` +
        `viewport horizontally. Fix the layout; do NOT re-record the baseline.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} screenshot baseline(s) are not their viewport's width:\n`);
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exit(1);
}

if (checked === 0) {
  // An empty pass is the failure mode this check is most likely to develop: a moved
  // directory or a renamed project would make it silently verify nothing.
  console.error(`✖ no baselines found under ${ROOT} — this check verified nothing.`);
  process.exit(1);
}

console.log(`✓ ${checked} screenshot baselines are exactly their viewport's width`);
