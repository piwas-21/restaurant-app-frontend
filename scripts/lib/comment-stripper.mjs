/**
 * Comment stripping for the source-reading gates, strings TRACKED but PRESERVED.
 *
 * Extracted 2026-08-11 from `check-css-module-bindings.mjs`, which had the only correct
 * implementation, once `check-undefined-css-vars.mjs` needed the same thing and its own naive
 * regex version silently blanked 21 lines of live JSX. Sharing it is the point: this logic is
 * subtle enough that two copies means one of them is wrong.
 *
 * TWO CONSTRAINTS THAT PULL IN OPPOSITE DIRECTIONS, and both are load-bearing:
 *
 *   - **Strings must be TRACKED**, or the `/*` inside `accept="image/*"` opens a block comment
 *     that runs to the file's next real close. Four files in this tree carry exactly that
 *     attribute; `lib/ratchet.mjs` records the same bug blinding two earlier gates, and the
 *     undefined-CSS-var gate re-introduced it while its own docstring name-checked the trap.
 *   - **Strings must be PRESERVED**, because the references these gates read live inside them:
 *     `` className={`${styles.a}`} `` and `stroke="var(--fp-faint)"`. `lib/ratchet.mjs`'s stripper
 *     deliberately drops template-literal CONTENTS — right for counting patterns in code, exactly
 *     wrong here. Reusing it made one gate report ZERO interpolated references, blind to the single
 *     class it most needed to see.
 *
 * So tracking is what stops a comment opening inside a string, and preserving is what keeps the
 * payload visible. A stripper that does only one of the two is broken in one direction or the other.
 *
 * Comments are removed rather than blanked to a fixed width, so callers must not rely on column
 * offsets. Line COUNT is preserved, so line numbers stay honest.
 */

/** String delimiters. CSS has the first two; JS/TSX adds the template literal. */
const QUOTES = new Set(["'", '"', '`']);

/**
 * Copy from `from` up to and including the closing `quote`.
 *
 * Returns the text, the next index, and the quote if the span is still OPEN at end of line — which
 * only matters for a template literal, the one delimiter that survives a newline.
 */
function copyToQuoteEnd(line, from, quote) {
  let text = '';
  let j = from;

  while (j < line.length) {
    if (line[j] === '\\') {
      text += line.slice(j, j + 2);
      j += 2;
      continue;
    }

    text += line[j];
    j += 1;
    if (text.endsWith(quote)) return { text, next: j, open: null };
  }

  return { text, next: j, open: quote };
}

/** Skip to just past this line's `*​/`, or to the end if the block continues. */
function skipBlockComment(line, from) {
  const close = line.indexOf('*/', from);
  return close === -1 ? { next: line.length, state: 'block' } : { next: close + 2, state: 'code' };
}

/**
 * Consume a string span, either OPENING one at `i` or continuing one carried from a previous line.
 *
 * Both callers want the same three things back, so they share this rather than each spelling out
 * the `?? 'code'` fallback.
 */
function takeStringSpan(line, i, quote, opening) {
  const span = copyToQuoteEnd(line, opening ? i + 1 : i, quote);
  return { text: (opening ? quote : '') + span.text, next: span.next, state: span.open ?? 'code' };
}

/**
 * One step of the scanner: what to emit at `i`, where to go next, and the state to carry.
 *
 * Split out of `stripLine` so each case sits at depth 1 instead of nested inside the loop — the
 * branches are the same, but the loop below becomes trivial and neither function is a thicket.
 * `stop` means the rest of the line is comment (a `//`, or a block that runs past the end).
 */
function consumeToken(line, i, state, lineComments) {
  if (state === 'block') {
    const step = skipBlockComment(line, i);
    return step.state === 'block' ? { stop: true, state: 'block' } : { text: '', next: step.next, state: 'code' };
  }

  // A quote we are still inside, carried from the previous line (only a template literal can be).
  if (state !== 'code') return takeStringSpan(line, i, state, false);

  const two = line.slice(i, i + 2);
  if (lineComments && two === '//') return { stop: true, state: 'code' };
  if (two === '/*') return { text: '', next: i + 2, state: 'block' };
  if (QUOTES.has(line[i])) return takeStringSpan(line, i, line[i], true);

  return { text: line[i], next: i + 1, state: 'code' };
}

/**
 * One line, comments removed and strings preserved, plus the span still open at the end of it.
 *
 * `lineComments` is false for CSS: it has no `//` syntax, and treating one as a comment would eat
 * the rest of a protocol-relative `url(//cdn…)`.
 */
function stripLine(line, carried, lineComments) {
  let out = '';
  let state = carried;
  let i = 0;

  while (i < line.length) {
    const step = consumeToken(line, i, state, lineComments);
    state = step.state;
    if (step.stop) break;
    out += step.text;
    i = step.next;
  }

  // Only a block comment and a template literal carry across a newline; resetting the other two
  // stops one unbalanced apostrophe swallowing the rest of the file.
  return { out, carried: state === 'block' || state === '`' ? state : 'code' };
}

/**
 * Source as an array of comment-free lines, one per input line.
 *
 * @param {string} source
 * @param {{ lineComments?: boolean }} [options] `lineComments` defaults to true (JS/TSX); pass
 *   false for CSS.
 */
export function stripCommentLines(source, { lineComments = true } = {}) {
  const lines = [];
  let carried = 'code';

  for (const line of source.split('\n')) {
    const step = stripLine(line, carried, lineComments);
    carried = step.carried;
    lines.push(step.out);
  }

  return lines;
}

/** The same thing as one string, for callers that scan across line boundaries. */
export function stripComments(source, options) {
  return stripCommentLines(source, options).join('\n');
}
