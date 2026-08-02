#!/usr/bin/env node
/**
 * Ratchet on `} catch {` — a catch with no binding.
 *
 * `apiClient` THROWS `ApiError(status, message, errors[])` on every non-2xx, so the server's
 * diagnosis — including the per-rule validation messages — arrives *in the thrown object*. A catch
 * with no binding discards it in full and leaves the component printing something generic. That is
 * BUGS-IMPROVEMENTS-PLAN E9, and it is not one screen: the count was 103 when the report was
 * triaged.
 *
 * This is a RATCHET, not a ban. The sweep (E9 step 3) runs feature area by feature area over
 * several PRs, so a hard failure today would just mean 100 inline suppressions. Instead the count
 * may only ever go DOWN: adding a bare catch fails the gate, removing one and forgetting to
 * re-baseline also fails it — loudly, with the new number to paste in. A ratchet that only tightens
 * cannot rot the way a "we'll clean it up later" comment does.
 *
 * Not ESLint: `--max-warnings=0` is already the repo's setting, so a warning IS an error there, and
 * ESLint has no baseline mechanism to hold 100 known sites without per-file disables.
 *
 * Two things it is NOT:
 *
 * - **Not a measure of the defect.** It counts SYNTAX. `} catch (e) { setError(t('failed')) }`
 *   discards the server's `errors[]` just as completely and would *lower* this number. Binding the
 *   error is the first half of the fix; surfacing it is the half that matters, and no regex can see
 *   that. Read the remediation text below as "bind it AND surface it".
 * - **Not aiming at zero.** Roughly a dozen of the current sites ignore a failure on purpose —
 *   `TableContext` discarding malformed `localStorage`, `analytics` feature-detecting
 *   `CustomEvent`, the mock-API fallbacks in `menuService`/`categoryService`, `qrCode`. Those
 *   should stay, and converting them to bound catches would buy nothing. The honest target is
 *   ~90, not 0.
 *
 * Depends on prettier normalising `catch` onto the closing brace: a `catch {` alone on its own line
 * would not match. That holds because `prettier --check` gates all of `src/`.
 *
 *   node scripts/check-bare-catch.mjs             # verify
 *   node scripts/check-bare-catch.mjs --regen     # re-baseline after removing some
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'bare-catch-baseline.json');

/** Tests may swallow deliberately — they are asserting the failure, not reporting it. */
const isSource = (f) => /^src\/.*\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f);

const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' }).split('\n').filter(isSource);

/**
 * Strip the places where `} catch {` is being TALKED ABOUT rather than written: a line comment, a
 * block-comment continuation, or a backtick span. Without this the tool counted its own
 * documentation — two of the sites in the first baseline were prose in `apiFormErrors.ts` and
 * `RegisterStaffModal.tsx` explaining the very defect. That is not a cosmetic miscount: a prettier
 * reflow of either comment would change the number and red an unrelated PR with "count FELL — bank
 * it", pointing the author at a figure that has nothing to do with catches.
 */
function isProse(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}
const stripCode = (line) => line.replace(/`[^`]*`/g, '');

const found = [];
for (const file of files) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isProse(line)) return;
    // `} catch {` only. A bound `} catch (e) {` is the shape we are migrating TO, so it must not
    // be counted — the point is the discarded error object, not the catch.
    if (/}\s*catch\s*{/.test(stripCode(line))) found.push(`${file}:${i + 1}`);
  });
}

if (process.argv.includes('--regen')) {
  writeFileSync(baselinePath, `${JSON.stringify({ count: found.length }, null, 2)}\n`);
  console.log(`✓ bare-catch baseline regenerated (${found.length})`);
  process.exit(0);
}

const { count: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

if (found.length > baseline) {
  console.error(`✗ bare \`} catch {\` count rose: ${baseline} → ${found.length}`);
  console.error("  A catch with no binding throws away the server's own message (E9).");
  console.error('  Bind it AND SURFACE it — `useApiError().capture(error)`, or `routeApiError`.');
  console.error('  Binding alone satisfies this gate and fixes nothing; the message has to reach a user.');
  console.error('  If the failure is ignored on purpose, say so in a comment and leave the count alone.');
  console.error(`\n  ${found.slice(-10).join('\n  ')}`);
  process.exit(1);
}

if (found.length < baseline) {
  console.error(`✗ bare \`} catch {\` count FELL: ${baseline} → ${found.length} — bank it:`);
  console.error('    node scripts/check-bare-catch.mjs --regen');
  process.exit(1);
}

console.log(`✓ bare \`} catch {\` holding at ${found.length} (E9 sweep in progress)`);
