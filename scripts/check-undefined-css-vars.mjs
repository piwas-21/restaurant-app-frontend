#!/usr/bin/env node
/**
 * Gate: every `var(--x)` written WITHOUT a fallback names a custom property something defines.
 *
 * WHAT THE DEFECT ACTUALLY IS. `var(--undefined-name)` with no fallback makes the whole
 * declaration **invalid at computed-value time** — the property falls back to its inherited or
 * initial value and the rule silently paints nothing. `background: var(--card-bg)` on an admin
 * panel is not "slightly off", it is transparent.
 *
 * WHY NOTHING ELSE CATCHES IT — the same blind spot `check-css-module-bindings.mjs` documents,
 * one layer down. There the NAME was dead; here the name is fine and the VALUE never resolves:
 *
 *   - prettier and stylelint accept `var(--anything)` because it IS valid syntax.
 *   - jest maps CSS modules to `identity-obj-proxy`, so no rendering assertion can see a value.
 *   - the selectors / bindings / composes / physical-CSS gates parse STRUCTURE, not values.
 *   - a screenshot only sees a page someone actually opened, and these cluster on admin and
 *     cashier surfaces that no baseline covers.
 *
 * Only a browser knows, and only for the one route it is pointed at. #335 was one instance
 * (`--background-light`, 22 references, defined nowhere); #489 measured 34 more.
 *
 * FOUR WAYS THE NAIVE VERSION FAILS **OPEN**. Each was found by prototyping, and each would have
 * made a green run meaningless:
 *
 *   1. **A fallback is not a defect.** `var(--x, #fff)` always resolves, so an undefined name
 *      there cannot produce an invalid declaration. 127 references carry one. They are COUNTED
 *      and reported, never failed on — folding them in would have tripled the baseline with
 *      non-defects and buried the 34 real ones.
 *   2. **CSS is not the only definition mechanism.** `--font-body` / `--font-display` are declared
 *      by next/font's `variable:` option in each template's `fonts.ts` and never appear as a `--x:`
 *      declaration anywhere. Inline `style={{ '--x': v }}` and `element.style.setProperty('--x')`
 *      are definitions too. A CSS-only scan calls all three undefined.
 *
 *      (This very comment had to be reworded: writing that path with a glob puts a `*` and a `/`
 *      adjacent, which CLOSES this block comment and makes the file a syntax error. Same family as
 *      the `accept="image/*"` trap recorded in `lib/ratchet.mjs`.)
 *   3. **Dynamically-constructed names are not references** — a `var(--x-${id})` reported as the
 *      literal prefix `--x-` is an unfixable phantom that would sit in the baseline forever.
 *
 *      **This guard currently matches NOTHING, and saying so is the point.** #489 named
 *      `var(--fp-${id})` in `SceneDefs.tsx` and the `--modal-body-` hits as the motivating cases;
 *      measured, both claims are false. The `--fp-*` names are literal and defined in
 *      `FloorPlanScene.module.css`; every `--modal-body-*` reference carries a fallback and is
 *      excluded by rule 1, not by this one. A tree-wide search for `var(--…${` finds zero sites.
 *      The guard is kept because it is cheap and correct — it was fired deliberately, with and
 *      without, to prove it discriminates rather than assuming it — but it is protection against
 *      future code, NOT a filter doing present work. Do not cite it as evidence the baseline was
 *      cleaned of noise.
 *   4. **A run that resolves nothing must FAIL.** Per the rule the composes gate learned the hard
 *      way, the success line prints the corpus so a green run is falsifiable.
 *
 * THE RATCHET'S END IS ZERO, AND THAT IS THE POINT. The baseline is **debt to burn down, not a
 * budget to spend** — every entry is an element painting nothing today. Do NOT add to it to make a
 * change pass; fix the site or use a fallback. #489 tracks the burn-down, batched by surface area
 * (cashier, admin-reservations, admin-menu-editor, scan) because giving a dead property a real
 * value is a VISIBLE change: what is the parent surface, what text sits on it, does the AA margin
 * survive. #335's follow-up is the cautionary tale — four of its sites needed a *different* token
 * than the other eighteen, and three were caught only in manual review after every gate was green.
 *
 * `--background-light` is deliberately NOT baselined: #335 fixed it and
 * `src/design-system/tokens/surfaceTokenResolution.test.ts` already hard-zeroes that name.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const ROOT = path.join(REPO, 'src');
const BASELINE = path.join(HERE, 'undefined-css-vars-baseline.json');

const REGEN = process.argv.includes('--regen-baseline');

/** Tests are excluded: a fixture may name a property on purpose to assert the fallback path. */
const SCANNABLE = /\.(css|tsx?)$/;
const EXCLUDED = /\.(test|spec)\.tsx?$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SCANNABLE.test(entry.name) && !EXCLUDED.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Comments blanked, length-preserving so reported offsets stay honest.
 *
 * Both syntaxes, because the corpus is mixed: `/* *​/` covers CSS and JS/TSX, `//` only the latter.
 * Stripping first is not tidiness — a commented-out rule explaining a property that was REMOVED
 * otherwise reports the very reference the fix deleted as still live. That exact shape has bitten
 * the CSS readers in this repo repeatedly (see `check-css-selectors.mjs`).
 *
 * A `//` inside a CSS url() or a string would be mangled, so it is applied to `.css` files as
 * block-comments-only. CSS has no line comments, so nothing is lost.
 */
function stripComments(source, isCss) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (!isCss) out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  return out;
}

/**
 * Every `var(--name)` reference, split by whether it carries a fallback.
 *
 * Hand-scanned rather than regexed because the fallback test is a TOP-LEVEL comma inside the
 * `var(` call, and `var(--a, var(--b))` nests: the outer reference has a fallback, the inner one
 * does NOT and is a real defect. A regex either misses the inner call or mis-attributes the comma.
 */
function varReferences(text) {
  const refs = [];

  for (let i = text.indexOf('var('); i !== -1; i = text.indexOf('var(', i + 1)) {
    let j = i + 4;
    while (j < text.length && /\s/.test(text[j])) j += 1;

    const nameStart = j;
    while (j < text.length && /[\w-]/.test(text[j])) j += 1;
    const name = text.slice(nameStart, j);
    if (!name.startsWith('--')) continue;

    // A name immediately continued by a template placeholder is CONSTRUCTED, not referenced
    // (`var(--fp-${id})`). Reporting the literal prefix invents a property nobody can define.
    if (text.startsWith('${', j)) continue;

    // Walk to this call's own closing paren, tracking depth, and note a comma seen at depth 0.
    let depth = 1;
    let hasFallback = false;
    let k = j;
    for (; k < text.length && depth > 0; k += 1) {
      const c = text[k];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      else if (c === ',' && depth === 1) hasFallback = true;
    }
    // An unterminated call means the file does not parse; do not guess a verdict from it.
    if (depth !== 0) continue;

    refs.push({ name, hasFallback });
  }

  return refs;
}

/**
 * Every custom property this file DEFINES, by any of the four mechanisms.
 *
 * The last two are why a CSS-only scan is wrong: next/font declares `--font-body` through
 * `variable:` and it exists at runtime with no `--font-body:` anywhere in the tree.
 */
function definitions(text, isCss) {
  const names = new Set();

  // 1. A CSS declaration: `--x: value`. Anchored on a boundary so `var(--x)` cannot match — the
  //    reference has no colon after the name, but `:root{--a:1}` and `;--b:2` both must.
  for (const [, name] of text.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/gm)) names.add(name);

  if (isCss) return names;

  // 2. An object key in an inline style: `style={{ '--x': v }}`.
  for (const [, name] of text.matchAll(/['"](--[\w-]+)['"]\s*:/g)) names.add(name);
  // 3. An imperative set: `el.style.setProperty('--x', v)`.
  for (const [, name] of text.matchAll(/setProperty\(\s*['"](--[\w-]+)['"]/g)) names.add(name);
  // 4. next/font: `Playfair_Display({ variable: '--font-display' })`.
  for (const [, name] of text.matchAll(/\bvariable\s*:\s*['"](--[\w-]+)['"]/g)) names.add(name);

  return names;
}

const files = walk(ROOT);

const defined = new Set();
const scanned = [];

for (const file of files) {
  const isCss = file.endsWith('.css');
  const text = stripComments(readFileSync(file, 'utf8'), isCss);
  for (const name of definitions(text, isCss)) defined.add(name);
  scanned.push({ file, text, isCss });
}

const violations = [];
let referenceCount = 0;
let fallbackCount = 0;

for (const { file, text } of scanned) {
  const seen = new Set();

  for (const { name, hasFallback } of varReferences(text)) {
    referenceCount += 1;
    if (hasFallback) {
      fallbackCount += 1;
      continue;
    }
    if (defined.has(name)) continue;

    // One entry per (file, property). A property used on ten rules in one stylesheet is one site
    // to fix, and ten baseline rows would make the burn-down look ten times larger than it is.
    const key = `${path.relative(REPO, file)} :: ${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push(key);
  }
}

const cssCount = scanned.filter((s) => s.isCss).length;

if (files.length === 0 || referenceCount === 0 || defined.size === 0) {
  console.error(
    `Undefined-CSS-var gate examined NOTHING useful (${files.length} file(s), ` +
      `${referenceCount} reference(s), ${defined.size} definition(s)). ` +
      `Expected sources under ${ROOT}. Failing rather than passing vacuously.`,
  );
  process.exit(2);
}

const current = [...violations].sort((a, b) => a.localeCompare(b));

if (REGEN) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        comment:
          'DEBT, NOT A BUDGET. Every entry is a declaration that paints nothing. The target is 0 — ' +
          'see frontend #489. Never add an entry to make a change pass: fix the site, or give the ' +
          'var() a fallback.',
        undefined: current,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Baselined ${current.length} undefined custom-property reference(s).`);
  process.exit(0);
}

let baseline = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).undefined ?? [];
} catch {
  console.error(
    `Missing or unreadable ${path.relative(REPO, BASELINE)}. ` +
      'Run `node scripts/check-undefined-css-vars.mjs --regen-baseline` and commit it.',
  );
  process.exit(2);
}

const banked = new Set(baseline);
const added = current.filter((v) => !banked.has(v));
const fixed = baseline.filter((b) => !current.includes(b));

if (added.length > 0) {
  console.error('Undefined custom propert(ies): a var() with no fallback names nothing.\n');
  for (const v of added) console.error(`  ${v}`);
  console.error(
    '\nThe whole declaration is invalid at computed-value time — the element paints its inherited\n' +
      'or initial value, not yours. Nothing else in CI can see it: prettier and stylelint accept\n' +
      'var(--anything) as valid syntax, and identity-obj-proxy blinds every jest assertion.\n\n' +
      'Fix by pointing at a real token (src/design-system/tokens/), or give the var() a fallback\n' +
      'if the property is genuinely optional. Do NOT re-baseline to get past this.',
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.error(
    `${fixed.length} baselined undefined propert(ies) are fixed — bank them so they cannot return:\n` +
      '  node scripts/check-undefined-css-vars.mjs --regen-baseline\n',
  );
  for (const f of fixed) console.error(`  ${f}`);
  process.exit(1);
}

console.log(
  `Undefined CSS vars OK — examined ${files.length} file(s) (${cssCount} stylesheet(s)), ` +
    `${referenceCount} var() reference(s) of which ${fallbackCount} carry a fallback, ` +
    `${defined.size} definition(s); ${baseline.length} baselined (target 0, see #489).`,
);
