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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRatchet, walkFiles } from './lib/ratchet.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'physical-css-baseline.json');

const isSource = (f) => f.endsWith('.css');

/**
 * A declaration whose PROPERTY is physically directional.
 *
 * Anchored at the start of the line because prettier gates all of `src/` and puts exactly one
 * declaration on a line — so the anchor is what keeps a physical *value* (`right` in
 * `background-position: right 12px center`) from matching. `border-(left|right)` allows an
 * optional sub-property so `border-left-color` and `border-left-width` are caught: a state
 * rule that repaints only the colour of an accent bar has to move with the bar.
 */
const PHYSICAL = /^\s*(?:(?:margin|padding)-(?:left|right)|border-(?:left|right)(?:-[a-z]+)?|(?:left|right))\s*:/;
const PHYSICAL_TEXT_ALIGN = /^\s*text-align\s*:\s*(?:left|right)\s*(?:!important\s*)?;/;

/**
 * Blank out the places where a physical property is being TALKED ABOUT rather than declared.
 * `check-bare-catch.mjs` learned this the hard way — its first baseline counted two comments
 * *explaining* the defect it measured, so a prettier reflow of the prose would have red-lit an
 * unrelated PR. This sweep leaves a "physical on purpose: …" comment beside every declaration it
 * deliberately does not convert, so it generates that hazard by design.
 *
 * Matching a comment MARKER per line is not enough, and that was the original bug here: a line
 * that merely CONTINUES a block comment starts with neither of those markers, so a reflow that
 * moved `right:` to column 0 inside prose was counted as a declaration (verified — the count
 * rose by one). So track the block state across lines and erase commented spans outright, which
 * also covers a comment opened and closed on the same line as real code.
 */
const stripComments = (source) => {
  let inBlock = false;
  return source.split('\n').map((line) => {
    let out = '';
    for (let i = 0; i < line.length; i++) {
      if (inBlock) {
        if (line.startsWith('*/', i)) {
          inBlock = false;
          i++;
        }
      } else if (line.startsWith('/*', i)) {
        inBlock = true;
        i++;
      } else {
        out += line[i];
      }
    }
    return out;
  });
};

const found = [];
for (const file of walkFiles(root, join(root, 'src'), isSource)) {
  stripComments(readFileSync(join(root, file), 'utf8')).forEach((line, i) => {
    if (PHYSICAL.test(line) || PHYSICAL_TEXT_ALIGN.test(line)) found.push(`${file}:${i + 1}`);
  });
}

process.exit(
  runRatchet({
    found,
    baselinePath,
    label: 'physical CSS direction properties',
    script: 'scripts/check-physical-css.mjs',
    guidance: [
      'These do not follow `dir="rtl"`, so Arabic gets the gutter on the wrong side (E8).',
      'Use the logical twin: margin-inline-start / padding-inline-end /',
      'border-inline-start / inset-inline-start / text-align: start | end.',
      'If it is physical ON PURPOSE (it must not mirror), say so in a comment and',
      'leave the count alone — the comment is not counted.',
    ],
    holdingNote: 'E8 sweep in progress',
    argv: process.argv,
  }),
);
