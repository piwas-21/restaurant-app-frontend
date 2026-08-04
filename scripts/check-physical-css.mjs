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
 * - **Not aiming at zero. The end point is 8, it is ENUMERATED rather than estimated, and it has
 *   now been REACHED.** The sweep ran 365 → 28 (slice 2) → 26 (3a) → 19 → 13 → 11 (3b) → 8 (#424).
 *   Every one of the 8 that remain has been read, and they are one group:
 *
 *     EIGHT PERMANENT — centring, which has no handedness and is already correct both ways.
 *       app/styles/AdminPage.module.css:502-503     tooltip: left:50% + margin-left:-80px
 *       app/styles/UserMenu.module.css:60-61        dropdown: right:auto + left:50%
 *       components/TableBanner.module.css:32        banner: left:50%
 *       components/TableBanner.module.css:210-211   the mobile RESET of that pair (symmetric)
 *       components/cashier/QuickConfirmModal.module.css:17   modal: left:50%
 *
 *     The three notistack overrides that were BLOCKED here are gone — #424 landed. They were not
 *       a CSS change: one unqualified selector served two anchors, so converting it moved the
 *       bottom-right stacks correctly and clipped the top-center cart toast 151px off screen in
 *       `ar`. The fix scopes a class per anchor via notistack's `classes` prop, so the rule that
 *       converts no longer touches the centre one. Measured after, in `en` and `ar` alike:
 *       bottom-right 24px from the trailing edge at 1400px and full-bleed at 390px; centre
 *       550..850 at 1400px and 16..374 at 390px, where a mobile toast is full-bleed by design.
 *
 *   So **8 means "E8 is done"** — and 8 is also the FLOOR. If this number falls below 8, something
 *   that must not mirror has been converted; read the comment beside it before banking the drop.
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
import { runRatchet, stripComments, walkFiles } from './lib/ratchet.mjs';

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
 * A physical property is often TALKED ABOUT in a comment rather than declared — this sweep leaves
 * a "physical on purpose: …" note beside every declaration it deliberately skips. `stripComments`
 * (scripts/lib/ratchet.mjs) is the shared answer; its header records why matching a comment marker
 * per line was not enough, and the mutation that proved it.
 */
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
    holdingNote: 'E8 COMPLETE — 8 permanent centring idioms; the 3 notistack overrides landed in #424',
    argv: process.argv,
  }),
);
