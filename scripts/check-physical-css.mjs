#!/usr/bin/env node
/**
 * Ratchet on physical direction properties in CSS — `margin-left`, `border-right`,
 * `text-align: left`, `left:`/`right:` and friends.
 *
 * `ar` is one of the ten locales and `DocumentLanguage` now sets `dir="rtl"` for it
 * (BUGS-IMPROVEMENTS-PLAN E8 slice 1). A physical property does not follow `dir`: a
 * `margin-left` stays on the left of the screen when the whole layout has mirrored, so the
 * gutter lands on the wrong side of its own text. The logical twin (`margin-inline-start`)
 * follows the writing direction and is byte-for-byte identical under `dir="ltr"`.
 *
 * This is a RATCHET, not a ban. The sweep (E8 slice 2) runs feature area by feature area
 * over several PRs, so a hard failure today would just mean ~250 inline suppressions. The
 * count may only ever go DOWN: adding a physical property fails the gate, removing some and
 * forgetting to re-baseline also fails it — loudly, with the new number to paste in.
 *
 * Two things it is NOT:
 *
 * - **Not a defect count.** It counts SYNTAX. Some of these are *correctly* physical and
 *   must never be converted, because they describe something that does not mirror when the
 *   reading direction does. The floor plan is the clear case: a physical room keeps its
 *   handedness, so its geometry is screen-space by design (`lib/floorPlan/geometry.ts` reads
 *   `DOMRect.left`, which is not CSS at all and is out of this tool's reach anyway).
 *   Decorative asymmetry — the craft `--craft-tape-clip` polygon — is the same story.
 *   Anything deliberately physical should carry a comment saying so and stay in the count.
 * - **Not aiming at zero.** See above. There is no measured floor yet; the first areas swept
 *   were entirely mirror-safe, so the floor is discovered as the sweep proceeds rather than
 *   asserted up front.
 *
 * Values are not properties. `background-position: right 12px center` is a physical *value*
 * on a non-directional property and is deliberately not matched — only declarations whose
 * PROPERTY is directional count.
 *
 *   node scripts/check-physical-css.mjs             # verify
 *   node scripts/check-physical-css.mjs --regen     # re-baseline after converting some
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'physical-css-baseline.json');

const isSource = (f) => f.endsWith('.css');

/**
 * Walk `src/` directly rather than shelling out to `git ls-files` — same two reasons as
 * `check-bare-catch.mjs`: Sonar S4036 (resolving `git` through a writable `PATH`), and
 * `git ls-files` omitting UNTRACKED files, so a brand-new stylesheet would not be counted
 * until it was staged.
 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (isSource(entry.name)) out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/**
 * A declaration whose PROPERTY is physically directional.
 *
 * Anchored at the start of the line because prettier gates all of `src/` and puts exactly one
 * declaration on a line — so the anchor is what keeps a physical *value* (`right` in
 * `background-position: right 12px center`) from matching. `border-(left|right)` allows an
 * optional sub-property so `border-left-color` and `border-left-width` are caught: a state
 * rule that repaints only the colour of an accent bar has to move with the bar.
 */
const PHYSICAL =
  /^\s*(?:(?:margin|padding)-(?:left|right)|border-(?:left|right)(?:-[a-z]+)?|(?:left|right))\s*:/;
const PHYSICAL_TEXT_ALIGN = /^\s*text-align\s*:\s*(?:left|right)\s*(?:!important\s*)?;/;

/**
 * Strip the places where a physical property is being TALKED ABOUT rather than declared: a
 * line comment or a block-comment continuation. `check-bare-catch.mjs` learned this the hard
 * way — its first baseline counted two comments *explaining* the defect it measured, so a
 * prettier reflow of the prose would have red-lit an unrelated PR. The comments below this
 * sweep leaves behind ("physical on purpose: …") are exactly that hazard.
 */
const isProse = (line) => /^\s*(\/\*|\*)/.test(line);

const found = [];
for (const file of walk(join(root, 'src'))) {
  readFileSync(join(root, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (isProse(line)) return;
      if (PHYSICAL.test(line) || PHYSICAL_TEXT_ALIGN.test(line)) found.push(`${file}:${i + 1}`);
    });
}

if (process.argv.includes('--regen')) {
  writeFileSync(baselinePath, `${JSON.stringify({ count: found.length }, null, 2)}\n`);
  console.log(`✓ physical-CSS baseline regenerated (${found.length})`);
  process.exit(0);
}

const { count: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

if (found.length > baseline) {
  console.error(`✗ physical CSS direction properties rose: ${baseline} → ${found.length}`);
  console.error('  These do not follow `dir="rtl"`, so Arabic gets the gutter on the wrong side (E8).');
  console.error('  Use the logical twin: margin-inline-start / padding-inline-end /');
  console.error('  border-inline-start / inset-inline-start / text-align: start | end.');
  console.error('  If it is physical ON PURPOSE (it must not mirror), say so in a comment and');
  console.error('  leave the count alone — the comment is not counted.');
  console.error(`\n  ${found.slice(-10).join('\n  ')}`);
  process.exit(1);
}

if (found.length < baseline) {
  console.error(`✗ physical CSS direction properties FELL: ${baseline} → ${found.length} — bank it:`);
  console.error('    node scripts/check-physical-css.mjs --regen');
  process.exit(1);
}

console.log(`✓ physical CSS direction properties holding at ${found.length} (E8 sweep in progress)`);
