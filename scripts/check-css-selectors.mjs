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

/** Everything but newlines replaced by spaces, so offsets and line numbers survive. */
const blank = (text) => text.replace(/[^\n]/g, ' ');

/** Index just past the closing quote of the string starting at `start` (or end of input). */
function endOfQuoted(css, start) {
  const quote = css[start];
  let i = start + 1;

  while (i < css.length) {
    if (css[i] === '\\') {
      i += 2;
      continue;
    }
    if (css[i] === quote) return i + 1;
    i += 1;
  }

  return i;
}

/**
 * Blank comment bodies AND string interiors in one pass, preserving offsets so a reported line
 * number still points at the line the author is looking at.
 *
 * Both halves are needed, and for different reasons. Comments must be found STRING-AWARE, or
 * `content: '/*'` reads as opening a comment and blanks everything to the next `*​/` — swallowing
 * real prose and letting this gate pass the very bug it exists for. And string interiors must then
 * be emptied, or `content: '{'` pushes the rule stack and `content: '}'` pops it, desynchronising
 * every prelude after it in the file.
 *
 * Written as a scanner rather than two regexes: the obvious `'([^'\\\n]|\\.)*'` puts an
 * alternation inside a repetition, which is the classic super-linear backtracking shape for a check
 * that runs on every commit.
 */
function sanitize(css) {
  let out = '';
  let i = 0;

  while (i < css.length) {
    const ch = css[i];

    if (ch === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      const end = close === -1 ? css.length : close + 2;
      out += blank(css.slice(i, end));
      i = end;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const end = endOfQuoted(css, i);
      const span = css.slice(i, end);
      const closed = span.length > 1 && span.endsWith(ch);
      out += ch + blank(span.slice(1, closed ? -1 : undefined)) + (closed ? ch : '');
      i = end;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * What a `{` opens, from the prelude in front of it.
 *
 * `keyframes` bodies hold `from`/`to`/percentages; any other NON-nesting at-rule (`@font-face`,
 * `@property`) holds declarations. Neither contains selectors, so both are opaque. A nesting
 * at-rule (`@media`, `@supports`, `@layer`) is transparent — that is where half of this tree's CSS
 * lives, and its children are ordinary rules.
 */
function frameFor(prelude) {
  if (!prelude.startsWith('@')) return 'rule';

  const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase();
  if (name === 'keyframes') return 'keyframes';

  return name && NESTING_AT_RULES.has(name) ? 'rule' : 'opaque';
}

/** Every rule prelude in the file, with the line it starts on. */
function preludes(css) {
  const found = [];
  const stack = [];
  let buffer = '';
  let bufferLine = 1;
  let line = 1;

  for (const ch of css) {
    if (ch === '\n') {
      line += 1;
      if (!buffer.trim()) bufferLine = line;
      buffer += ch;
      continue;
    }

    if (ch === '{') {
      const prelude = buffer.trim();
      const opaque = stack.includes('keyframes') || stack.includes('opaque');

      if (prelude && !prelude.startsWith('@') && !opaque) {
        found.push({ prelude, line: bufferLine });
      }

      stack.push(frameFor(prelude));
      buffer = '';
      bufferLine = line;
      continue;
    }

    // `}` closes a block; `;` ends a declaration or an at-statement like `@import`. Neither can be
    // part of a prelude, so both just reset the buffer.
    if (ch === '}' || ch === ';') {
      if (ch === '}') stack.pop();
      buffer = '';
      bufferLine = line;
      continue;
    }

    buffer += ch;
  }

  return found;
}

/**
 * Blank out `[...]` and `(...)` spans, tracking DEPTH.
 *
 * Their contents are selectors in their own right (`:is(.a, .b)`) and a nested one that mattered
 * would be caught on its own rule anyway. Depth-tracked rather than regex-replaced because
 * `:is(:not(.x))` nests, which a `\([^)]*\)` pass mis-handles — and because that pass was flagged
 * for super-linear backtracking.
 */
function stripBracketed(selector) {
  let out = '';
  let depth = 0;

  for (const ch of selector) {
    if (ch === '[' || ch === '(') {
      depth += 1;
      out += ' ';
    } else if (ch === ']' || ch === ')') {
      depth = Math.max(0, depth - 1);
      out += ' ';
    } else {
      out += depth > 0 ? ' ' : ch;
    }
  }

  return out;
}

/**
 * The element names a selector begins its compounds with.
 *
 * Only a name in TYPE position counts — one not preceded by `.`, `#`, `:`, `[` or `%`. `.card p`
 * yields `p`; `.card` yields nothing; `:global(.x)` yields nothing.
 */
function typeSelectors(selector) {
  const out = [];

  for (const compound of stripBracketed(selector).split(/[\s>+~,]+/)) {
    const match = /^([A-Za-z][A-Za-z0-9-]*)/.exec(compound.trim());
    if (match) out.push(match[1]);
  }

  return out;
}

const files = walk(ROOT);
const violations = [];
let ruleCount = 0;
let selectorCount = 0;

for (const file of files) {
  const css = sanitize(readFileSync(file, 'utf8'));

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
