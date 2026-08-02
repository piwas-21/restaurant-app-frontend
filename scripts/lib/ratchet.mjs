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
