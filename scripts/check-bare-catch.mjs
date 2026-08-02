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
 *   `CustomEvent`, `orderTypeLabels` feature-detecting `Intl.ListFormat`, `imageCompression`
 *   falling back to the original file, `qrCode` parsing an untrusted payload. Those should stay,
 *   and converting them to bound catches would buy nothing.
 *   The mock-API fallbacks in `menuService`/`categoryService` used to be on that list and have
 *   been REMOVED from it: `mockApiClient` has no environment gate, so those catches do not ignore
 *   a failure, they replace it with invented menu items on a live tenant. They are open work, not
 *   survivors, and they are flagged as such in the files (issue #398).
 *
 * **Where this ends: a count of roughly 12.** An earlier version of this header said "the honest
 * target is ~90, not 0", which read as a target *count* and contradicted the line above it — if
 * ~12 sites should stay, ~12 is where the count lands, and at 91 today the sweep would already be
 * over. The ~90 was never a destination; it was the SIZE OF THE WORK — the ~88 sites that do need
 * fixing, out of the 100 counted at triage. That reading is also the only one the "1-2 week"
 * estimate in BUGS-IMPROVEMENTS-PLAN E9 makes sense under.
 *
 * So: keep going until only the deliberate ignores remain. Each one should carry a comment saying
 * why it ignores the failure — that comment, not this number, is what tells the next reader the
 * sweep is finished rather than abandoned.
 *
 * Depends on prettier normalising `catch` onto the closing brace: a `catch {` alone on its own line
 * would not match. That holds because `prettier --check` gates all of `src/`.
 *
 *   node scripts/check-bare-catch.mjs             # verify
 *   node scripts/check-bare-catch.mjs --regen     # re-baseline after removing some
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRatchet, stripComments, walkFiles } from './lib/ratchet.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'bare-catch-baseline.json');

/** Tests may swallow deliberately — they are asserting the failure, not reporting it. */
const isSource = (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f);

const files = walkFiles(root, join(root, 'src'), isSource);

/**
 * `} catch {` is often TALKED ABOUT rather than written — the two sites in this ratchet's FIRST
 * baseline were prose in `apiFormErrors.ts` and `RegisterStaffModal.tsx` explaining the very
 * defect it counts, and the sweep now leaves an "IGNORED ON PURPOSE" comment beside every
 * deliberate survivor. `stripComments` (scripts/lib/ratchet.mjs) handles comments; its header
 * records why matching a comment marker per line was not enough — and why it also has to know
 * about STRINGS, since a `} catch {` written below an `accept="image/*"` would otherwise sit in a
 * phantom comment that runs to the end of the file. Template literals are consumed there too, so
 * this file no longer strips backticks of its own.
 */
const found = [];
for (const file of files) {
  stripComments(readFileSync(join(root, file), 'utf8'), { lineComments: true }).forEach((line, i) => {
    // `} catch {` only. A bound `} catch (e) {` is the shape we are migrating TO, so it must not
    // be counted — the point is the discarded error object, not the catch.
    if (/}\s*catch\s*{/.test(line)) found.push(`${file}:${i + 1}`);
  });
}

process.exit(
  runRatchet({
    found,
    baselinePath,
    label: 'bare `} catch {` count',
    script: 'scripts/check-bare-catch.mjs',
    guidance: [
      "A catch with no binding throws away the server's own message (E9).",
      'Bind it AND SURFACE it — `useApiError().capture(error)`, or `routeApiError`.',
      'Binding alone satisfies this gate and fixes nothing; the message has to reach a user.',
      'If the failure is ignored on purpose, say so in a comment and leave the count alone.',
    ],
    holdingNote: 'E9 sweep in progress',
    argv: process.argv,
  }),
);
