/**
 * The shared half of a count ratchet.
 *
 * Two of these exist — `check-bare-catch.mjs` (E9) and `check-physical-css.mjs` (E8) — and a
 * third is plausible. Each one is a long-running sweep across feature areas where a hard ban
 * today would only produce a pile of inline suppressions, so instead a baseline count is
 * committed and may move in one direction. Everything about *that* is identical between them:
 * find the files, compare against the baseline, fail on a rise, fail on an un-banked fall.
 * Only the pattern being counted and the wording of the advice differ.
 *
 * Keeping the scaffolding here is not just tidiness — Sonar measures duplication, and the
 * second ratchet failed the new-code duplication gate at 22.5% for copying the first.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** What ends each multi-line span. A quote state (`'` or `"`) is its own closer. */
const CLOSERS = { block: '*/', template: '`' };

/**
 * Advance past a span we are already inside. Returns where to resume and the state after it —
 * still open if the span does not end on this line.
 *
 * A backslash escapes the next character in a template literal or a quoted string, but NOT in a
 * block comment, where the closer still closes.
 */
function skipSpan(line, from, state) {
  const closer = CLOSERS[state] ?? state;
  let i = from;
  while (i < line.length) {
    if (state !== 'block' && line[i] === '\\') i += 2;
    else if (line.startsWith(closer, i)) return { next: i + closer.length, state: 'code' };
    else i += 1;
  }
  return { next: line.length, state };
}

/** Which span, if any, OPENS at `i`. `'line'` means "the rest of the line is a comment". */
function spanAt(line, i, lineComments) {
  const two = line.slice(i, i + 2);
  if (two === '/*') return 'block';
  if (lineComments && two === '//') return 'line';
  if (line[i] === '`') return 'template';
  if (line[i] === "'" || line[i] === '"') return line[i];
  return null;
}

/**
 * Blank out every commented span, line by line, so a ratchet counts CODE and not its own prose.
 *
 * Both ratchets have made the mistake this exists to stop. The E9 one's first baseline counted two
 * comments *explaining* the defect it measures; the E8 one leaves a "physical on purpose: …" note
 * beside every declaration it deliberately skips, which is the same hazard generated on purpose.
 * The failure is nasty out of proportion to its cause: a prettier reflow of unrelated prose moves
 * the number, and the gate reds an innocent PR with "count FELL — bank it", pointing the author at
 * a figure that has nothing to do with their change.
 *
 * Matching a comment MARKER per line is not enough, and that was the bug in both: a line that
 * merely CONTINUES a block comment starts with neither slash-star nor an asterisk. Verified by
 * mutation — reflowing a property name to column 0 inside prose made the E8 count rise by one.
 *
 * So this is a small tokenizer rather than a regex, and it tracks STRINGS as well as comments —
 * which is not incidental. Scanning for a comment opener without knowing about strings blinds the
 * tool from the first `accept="image/*"` in a file to its end, and a bare catch written below that
 * line is never counted. A ratchet whose whole selling point is that it cannot quietly stop
 * working must not fail open, so quoted spans are consumed here too. Template literals and block
 * comments carry their state across lines; a plain quoted string cannot, so it resets at newline
 * rather than swallowing the rest of the file on an unbalanced apostrophe.
 *
 * @param source whole file contents
 * @param lineComments whether `//` starts a comment (true for JS/TS, false for CSS)
 * @returns one entry per input line, with commented and quoted spans removed
 */
export function stripComments(source, { lineComments = false } = {}) {
  // Only these two survive a newline. A quoted string does not: resetting at the line break is
  // what stops one unbalanced apostrophe from swallowing the rest of the file.
  let carried = 'code';

  return source.split('\n').map((line) => {
    let state = carried;
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (state !== 'code') {
        const span = skipSpan(line, i, state);
        state = span.state;
        i = span.next;
      } else {
        const opening = spanAt(line, i, lineComments);
        if (opening === 'line') break;
        if (opening === null) out += line[i];
        else state = opening;
        i += opening === 'block' ? 2 : 1;
      }
    }
    carried = state in CLOSERS ? state : 'code';
    return out;
  });
}

/**
 * Every file under `dir` that `isSource` accepts, as repo-relative POSIX paths.
 *
 * Walks the tree directly rather than shelling out to `git ls-files`. Two reasons, one of them
 * Sonar's (S4036: resolving `git` through `PATH` executes whatever a writable PATH entry
 * supplies) and one behavioural — `git ls-files` omits UNTRACKED files, so a brand-new file
 * carrying the very thing being counted would not be counted until it was staged. Catching it
 * before then is the whole point.
 */
export function walkFiles(root, dir, isSource) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(root, full, isSource));
    else if (isSource(entry.name)) out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Compare `found` against the committed baseline and exit.
 *
 * A fall is a FAILURE, not a pass. Banking it is one command, and the alternative — letting the
 * number drift below its baseline unnoticed — means the ratchet silently stops holding anything.
 *
 * @param {object}   o
 * @param {string[]} o.found        Sites found, as `path:line` strings.
 * @param {string}   o.baselinePath Absolute path to the `{ "count": n }` JSON baseline.
 * @param {string}   o.label        Human name of the thing counted, used in every message.
 * @param {string}   o.script       Script path to quote in the re-baseline instruction.
 * @param {string[]} o.guidance     Lines printed when the count RISES — what to do instead.
 * @param {string}   o.holdingNote  Parenthetical appended to the passing line.
 * @param {string[]} o.argv         Process args; `--regen` re-baselines.
 */
export function runRatchet({ found, baselinePath, label, script, guidance, holdingNote, argv }) {
  if (argv.includes('--regen')) {
    writeFileSync(baselinePath, `${JSON.stringify({ count: found.length }, null, 2)}\n`);
    console.log(`✓ ${label} baseline regenerated (${found.length})`);
    return 0;
  }

  const { count: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

  if (found.length > baseline) {
    console.error(`✗ ${label} rose: ${baseline} → ${found.length}`);
    for (const line of guidance) console.error(`  ${line}`);
    console.error(`\n  ${found.slice(-10).join('\n  ')}`);
    return 1;
  }

  if (found.length < baseline) {
    console.error(`✗ ${label} FELL: ${baseline} → ${found.length} — bank it:`);
    console.error(`    node ${script} --regen`);
    return 1;
  }

  console.log(`✓ ${label} holding at ${found.length} (${holdingNote})`);
  return 0;
}
