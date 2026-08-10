#!/usr/bin/env node
/**
 * Gate: no CSS rule may be introduced by a selector that is really English prose (§6 follow-up 11).
 *
 * WHY. **Nothing in CI parses CSS.** A comment in `MenuItemAvailability.module.css` lost its
 * opening `/*`, which left ~20 lines of English sitting where selectors go — and prettier, tsc,
 * eslint, jest, the file-length gate, the physical-CSS ratchet and the composes gate ALL passed it.
 * prettier most of all: it parsed the prose *as selectors*, reformatted it one word per line, and
 * reported the file clean. The browser was the first thing to object, with a 500 on `/menu`.
 *
 * A parse-error check cannot catch this, and that is the whole point. `The dimmed state is`
 * is perfectly VALID CSS — four type selectors joined by descendant combinators. The file parses;
 * it simply means nothing. So the gate tests something stronger than "does it parse": every type
 * selector must name an element that actually exists.
 *
 * That is what makes prose detectable and legitimate CSS safe. `svg`, `body`, `td`, `option` pass;
 * `The`, `dimmed`, `state` do not. The whole tree currently uses 34 distinct element names, all of
 * them real.
 *
 * SCOPE is every `.css` under `src/`, not just modules and not just menu: the hazard is a property
 * of CSS itself, and scoping a gate to a directory is what let an earlier sibling's corpus silently
 * vanish (see `check-composes-overrides.mjs`).
 *
 * FAIL-CLOSED. A run that examines nothing is a FAILURE, not a pass, and the success line prints
 * the counts it examined so a green run is falsifiable — the rule `scripts/lib/ratchet.mjs` argues
 * for the sibling gates.
 *
 * HARD ZERO, no baseline: the one historical violation was fixed when it was found, so there is
 * nothing to grandfather.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'src');

/**
 * Every element name a selector may legitimately begin with. HTML plus the SVG elements this tree
 * styles. An unknown name here is the signal — adding a genuinely new element is a one-line change
 * and a deliberate one, which is exactly the review moment this gate exists to create.
 */
const ELEMENTS = new Set([
  // Document + sections
  'html', 'body', 'head', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'address',
  // Grouping
  'div', 'p', 'hr', 'pre', 'blockquote', 'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'figure',
  'figcaption',
  // Text level
  'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data', 'time', 'code', 'var',
  'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u', 'mark', 'ruby', 'bdi', 'bdo', 'span', 'br', 'wbr',
  // Edits + embedded
  'ins', 'del', 'picture', 'source', 'img', 'iframe', 'embed', 'object', 'video', 'audio',
  'track', 'map', 'area', 'canvas',
  // Tables
  'table', 'caption', 'colgroup', 'col', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
  // Forms
  'form', 'label', 'input', 'button', 'select', 'datalist', 'optgroup', 'option', 'textarea',
  'output', 'progress', 'meter', 'fieldset', 'legend',
  // Interactive + scripting
  'details', 'summary', 'dialog', 'slot', 'template',
  // SVG (the subset this tree styles)
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'text',
  'tspan', 'defs', 'use', 'symbol', 'marker', 'clipPath', 'mask', 'pattern', 'image',
  'linearGradient', 'radialGradient', 'stop', 'filter', 'foreignObject',
]);

/** At-rules whose direct children are rules we must inspect. */
const NESTING_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'scope']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}

/**
 * Blank out comments while preserving offsets, so a reported line number still points at the line
 * the author is looking at. Replacing them with '' would shift every line after the first comment.
 *
 * STRING-AWARE, and it has to be: `content: '/*'` is a legal declaration, and a regex stripper
 * reads it as opening a comment and blanks everything to the next `*​/` — which would swallow real
 * prose and let this gate pass the very bug it exists for. Quoted spans are copied through
 * untouched; only genuine comments are blanked.
 */
function blankComments(css) {
  let out = '';
  let quote = null;
  let i = 0;

  while (i < css.length) {
    const ch = css[i];

    if (quote) {
      out += ch;
      if (ch === '\\') { out += css[i + 1] ?? ''; i += 2; continue; }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }

    if (ch === "'" || ch === '"') quote = ch;
    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Blank out the CONTENTS of quoted strings, offsets preserved.
 *
 * Run after comments, and for the other half of the same hazard: `content: '{'` would otherwise pop
 * the rule stack and `content: '}'` would push it, desynchronising every prelude after it in the
 * file. The strings themselves are never selectors, so nothing is lost by emptying them.
 */
function blankStrings(css) {
  return css.replace(/'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"/g, (m) => m[0] + ' '.repeat(m.length - 2) + m[0]);
}

/**
 * Every rule prelude in the file, with the line it starts on.
 *
 * At-rule preludes are skipped (`@media (min-width: …)` is not a selector), and so is everything
 * inside `@keyframes`, whose "selectors" are `from`, `to` and percentages. Rules nested inside
 * `@media`/`@supports`/`@layer` ARE collected — that is where half of this tree's CSS lives.
 */
function preludes(css) {
  const found = [];
  const stack = [];
  let buffer = '';
  let bufferLine = 1;
  let line = 1;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (ch === '\n') {
      line++;
      if (!buffer.trim()) bufferLine = line;
      buffer += ch;
      continue;
    }

    if (ch === '{') {
      const prelude = buffer.trim();
      const isAtRule = prelude.startsWith('@');
      const atName = isAtRule ? /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase() : null;
      // `keyframes` selectors are `from`/`to`/percentages; any other non-nesting at-rule
      // (`@font-face`, `@property`) contains declarations, never selectors. Both are skipped —
      // the marker is consulted rather than merely recorded, which an earlier draft did not do.
      const insideOpaque = stack.some((f) => f === 'keyframes' || f === 'opaque');

      if (!isAtRule && !insideOpaque && prelude) {
        found.push({ prelude, line: bufferLine });
      }

      // `keyframes` marks its whole body as off-limits; a nesting at-rule is transparent.
      stack.push(atName === 'keyframes' ? 'keyframes' : atName && !NESTING_AT_RULES.has(atName) ? 'opaque' : 'rule');
      buffer = '';
      bufferLine = line;
      continue;
    }

    if (ch === '}') {
      stack.pop();
      buffer = '';
      bufferLine = line;
      continue;
    }

    if (ch === ';') {
      // A declaration, or an at-statement like `@import`. Never a prelude.
      buffer = '';
      bufferLine = line;
      continue;
    }

    buffer += ch;
  }

  return found;
}

/**
 * The element names a selector begins its compounds with.
 *
 * Only a name in TYPE position counts — one not preceded by `.`, `#`, `:`, `[` or `%`. `.card p`
 * yields `p`; `.card` yields nothing; `:global(.x)` yields nothing.
 */
function typeSelectors(selector) {
  const out = [];
  // Strip attribute selectors and parenthesised argument lists (`:is(...)`, `:global(...)`,
  // `url(...)`) before splitting: their contents are selectors in their own right, and a nested
  // one that mattered would be caught on its own rule anyway.
  const flat = selector.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');

  for (const compound of flat.split(/[\s>+~,]+/)) {
    const token = compound.trim();
    if (!token) continue;

    const match = /^([A-Za-z][A-Za-z0-9-]*)/.exec(token);
    if (match) out.push(match[1]);
  }

  return out;
}

const files = walk(ROOT);
const violations = [];
let ruleCount = 0;
let selectorCount = 0;

for (const file of files) {
  const css = blankStrings(blankComments(readFileSync(file, 'utf8')));

  for (const { prelude, line } of preludes(css)) {
    ruleCount++;

    for (const selector of prelude.split(',')) {
      if (!selector.trim()) continue;
      selectorCount++;

      const unknown = typeSelectors(selector).filter((name) => !ELEMENTS.has(name));
      if (unknown.length > 0) {
        violations.push({
          file: path.relative(path.resolve(HERE, '..'), file),
          line,
          selector: selector.trim().replace(/\s+/g, ' '),
          unknown: [...new Set(unknown)],
        });
      }
    }
  }
}

// A corpus that vanished — a renamed directory, a moved src — must not read as success.
if (files.length === 0 || ruleCount === 0) {
  console.error(
    `CSS selector gate examined NOTHING (${files.length} file(s), ${ruleCount} rule(s)). ` +
      `Expected stylesheets under ${ROOT}. Failing rather than passing vacuously.`,
  );
  process.exit(2);
}

if (violations.length > 0) {
  console.error(
    `CSS selector gate: ${violations.length} rule(s) are introduced by something that is not a selector.\n` +
      'The usual cause is a comment that lost its opening "/*", leaving prose where selectors go.\n' +
      'Nothing else in CI parses CSS, so this ships a stylesheet the browser rejects at runtime.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.selector}`);
    console.error(`      unknown element name(s): ${v.unknown.join(', ')}`);
  }
  console.error(
    '\nIf one of these IS a real element, add it to ELEMENTS in scripts/check-css-selectors.mjs.',
  );
  process.exit(1);
}

console.log(
  `CSS selectors OK — ${files.length} stylesheet(s), ${ruleCount} rule(s), ${selectorCount} selector(s), ` +
    '0 non-element type selectors.',
);
