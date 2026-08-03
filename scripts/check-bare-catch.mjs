#!/usr/bin/env node
/**
 * Ratchet on `} catch {` — a catch with no binding.
 *
 * `apiClient` THROWS `ApiError(status, message, errors[])` on every non-2xx, so the server's
 * diagnosis — including the per-rule validation messages — arrives *in the thrown object*. A catch
 * with no binding discards it in full and leaves the component printing something generic. That is
 * BUGS-IMPROVEMENTS-PLAN E9, and it is not one screen: the count was 100 when the report was
 * triaged. (An earlier draft of this line said 103. That figure counted three COMMENTS describing
 * the pattern — the same miscount this script's own first baseline made, and the reason the
 * comment stripper exists at all.)
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
 * - **Not aiming at zero.** A documented set of sites ignore a failure on purpose —
 *   `TableContext` discarding malformed `localStorage`, `analytics` feature-detecting
 *   `CustomEvent`, `orderTypeLabels` feature-detecting `Intl.ListFormat`, `imageCompression`
 *   falling back to the original file, `qrCode` parsing an untrusted payload. Those should stay,
 *   and converting them to bound catches would buy nothing. The exact figure is below; that list
 *   is the ORIGINAL one and has not been the whole of it since slice 2.
 *
 *   This list also used to name "the mock-API fallbacks in `menuService`/`categoryService`" as
 *   deliberate. They were not: `mockApiClient` had no environment gate, so on a live tenant a
 *   backend outage rendered invented dishes at invented prices instead of the error the customer
 *   menu already had copy for. They are now DELETED (issue #398), not merely off the list. Worth
 *   remembering that this header vouched for them for as long as it did — "ignored on purpose" is
 *   a claim about intent, and intent is not evidence that the ignore is correct.
 *
 * **Where this ends: 29. Counted, not estimated — 2026-08-03, after slice 7.**
 *
 * This figure has been wrong twice, in both directions, and the corrections are the useful part:
 *
 * - It first read "the honest target is ~90, not 0". That was the SIZE OF THE WORK (the ~88 of the
 *   100 counted at triage that needed fixing), never a destination; read as a target count it
 *   contradicted the line above it and meant the sweep was over before it started.
 * - It then read "roughly 12", which was the count of the ORIGINAL deliberate list — the five
 *   feature-detects and `TableContext` — plus a guess. Slice 6 disproved it by finding 12
 *   documented survivors in `src/hooks` subfolders ALONE. The estimate that replaced it, ~22, was
 *   still low: it was assembled from THIS header's own list, which slice 2 had already outgrown,
 *   and so omitted the five documented ignores in `src/services` entirely.
 *
 * The lesson is the same one the ratchet keeps teaching: a number carried forward from a previous
 * revision of the same file is not a measurement. So this one was enumerated against the tree.
 *
 * The 29, by area — every one carries a comment saying why the failure is ignored:
 *
 *   src/hooks/<subfolders>   12   slice 6; `useCartPage` x5, the two raw-`fetch` auth forms,
 *                                 `useSavedAddressList`, `useGuestCustomerInfo`,
 *                                 `useGuestProfilePrefill`, `useAdminOrderMutations`,
 *                                 `useSetupChecklist`
 *   src/services              5   `authService`, `menuService`, `sessionService`,
 *                                 `tenantModulesService`, `tenantThemeService` (slice 2)
 *   src/utils                 4   `imageCompression`, `orderTypeLabels`, `qrCode` x2
 *   src/hooks (top level)     3   `useOrderFilterPreferences`' storage guards
 *   src/components/admin      3   `WorkingHoursManager` (#406, a per-PATH ignore);
 *                                 `DeleteConfirmationModal` (slice 7 — its producer reports and
 *                                 does not rethrow, so surfacing here would double-report); and
 *                                 `AppearanceTab`'s post-save `revalidateTenantTheme`, ADDED by
 *                                 slice 7 — a second round trip that runs AFTER the palette is
 *                                 saved, so letting it reach the outer catch toasted "Failed to
 *                                 save" for a save that succeeded. It is downgraded to a warning,
 *                                 not swallowed. A sweep can legitimately ADD a survivor.
 *   src/contexts              1   `TableContext`
 *   src/lib                   1   `analytics`
 *
 * **29 is a floor, not a prediction.** Four of those comments say WHAT happened rather than why
 * ignoring it is safe (`TableContext`'s "Invalid storage data, ignore", and the three in
 * `useOrderFilterPreferences`); whichever slice owns those areas should either strengthen them or
 * find that they are not deliberate after all — which is exactly what happened to the
 * `mockApiClient` pair this header used to vouch for. The number can therefore still move DOWN.
 *
 * Remaining work at that date: 19 sites (29 + 19 = the 48 baseline) — `src/app/**` 10,
 * `src/components` (non-admin) 5,
 * `src/hooks` top level 4 (`useOrders` x3, `useFeaturedSpecial`, the last of which may be dead
 * code: `getFeaturedSpecial` resolves `{success:true, data:null}` on failure by contract).
 *
 * So: keep going until only the deliberate ignores remain. Each one must carry a comment saying
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
