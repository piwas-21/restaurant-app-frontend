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
 * **THE SWEEP IS DONE. 34, and every one of them is a documented deliberate ignore — 2026-08-03,
 * after slice 8 (the last).** There is no remaining work item behind this number. What would
 * change it now is new code, which is what the ratchet is for from here on.
 *
 * The end point has been wrong four times, and the corrections are the useful part — especially
 * the last one, which moved it UP:
 *
 * - It first read "the honest target is ~90, not 0". That was the SIZE OF THE WORK (the ~88 of the
 *   100 counted at triage that needed fixing), never a destination; read as a target count it
 *   contradicted the line above it and meant the sweep was over before it started.
 * - It then read "roughly 12", which was the count of the ORIGINAL deliberate list — the five
 *   feature-detects and `TableContext` — plus a guess. Slice 6 disproved it by finding 12
 *   documented survivors in `src/hooks` subfolders ALONE.
 * - The estimate that replaced it, ~22, was assembled from THIS header's own list, which slice 2
 *   had already outgrown, and so omitted the five documented ignores in `src/services` entirely.
 * - Slice 7 then ENUMERATED the survivors against the tree and got 29 — that count was right. What
 *   was still an estimate was the OTHER half of the sum: it assumed all 19 un-triaged sites were
 *   work. FIVE of them turned out to be correct ignores that only needed saying so, so the sweep
 *   ended at 34, not 29. **Enumerating the known half of a total does not make the total a
 *   measurement.** A number is a measurement when every term in it has been looked at.
 * - And the first draft of THIS paragraph said "six … so the sweep ended at 35", three lines under
 *   a heading that correctly said 34. The sixth was `FidelityPointsCheckout`, which review turned
 *   from a survivor into a fix (see below) — the prose was written before the last change and not
 *   re-counted. Four revisions, four wrong numbers, every one of them a figure carried across an
 *   edit instead of re-derived. **Re-run the gate and re-add the table before touching this line.**
 *
 * The 34, by area — every one carries a comment saying why the failure is ignored. One further
 * site left the count without being converted: `MyOrders.tsx`'s catch went with the file, which
 * was dead code (no importer; `/my-orders` is a bare `redirect('/orders')`). So 48 → 34 is 13
 * conversions plus 1 deletion, not 14 conversions.
 *
 *   src/hooks/<subfolders>   12   slice 6; `useCartPage` x5, the two raw-`fetch` auth forms,
 *                                 `useSavedAddressList`, `useGuestCustomerInfo`,
 *                                 `useGuestProfilePrefill`, `useAdminOrderMutations`,
 *                                 `useSetupChecklist`
 *   src/services              5   `authService`, `menuService`, `sessionService`,
 *                                 `tenantModulesService`, `tenantThemeService` (slice 2)
 *   src/utils                 4   `imageCompression`, `orderTypeLabels`, `qrCode` x2
 *   src/hooks (top level)     4   `useOrderFilterPreferences`' three storage guards, and
 *                                 `useOrders`' 30s poll — added by slice 8, which took the OTHER
 *                                 two swallows out of that file (see below)
 *   src/components/admin      3   `WorkingHoursManager` (#406, a per-PATH ignore);
 *                                 `DeleteConfirmationModal` (slice 7 — its producer reports and
 *                                 does not rethrow, so surfacing here would double-report); and
 *                                 `AppearanceTab`'s post-save `revalidateTenantTheme`, ADDED by
 *                                 slice 7 — a second round trip that runs AFTER the palette is
 *                                 saved, so letting it reach the outer catch toasted "Failed to
 *                                 save" for a save that succeeded. It is downgraded to a warning,
 *                                 not swallowed. A sweep can legitimately ADD a survivor.
 *   src/app                   3   slice 8: `delete-account` and `forgot-password` — both call
 *                                 raw-`fetch` `authService` helpers that return `response.json()`
 *                                 for EVERY status, so a refusal RESOLVES and the only throws are
 *                                 a dead network and a non-JSON body, whose texts are
 *                                 client-authored; and `checkout/confirmation`'s tax-label lookup,
 *                                 which has a correct visible fallback
 *   src/components            1   slice 8: `DeleteAccountSection`, same raw-`fetch` reason
 *   src/contexts              1   `TableContext`
 *   src/lib                   1   `analytics`
 *
 * `FidelityPointsCheckout` was in that list on the first draft of this paragraph and is not any
 * more, which is the point of writing the reason down rather than the verdict. Its ignore was
 * genuinely right for the case it named — a GUEST's 401, where the section correctly renders
 * nothing — and wrong for the case it did not: a signed-in customer's 500 took their redemption
 * panel away mid-checkout with no explanation, so they could not spend a balance their account
 * page shows them. Bound and branched. **Ask what an ignore does on the input it does NOT name.**
 *
 * **The four weak comments this header used to flag are closed.** They said WHAT happened rather
 * than why ignoring it was safe; slice 8 answered them in place. Three (`useOrderFilterPreferences`)
 * were safe as written. The fourth was NOT: `TableContext` caught `JSON.parse` and then fed the
 * result straight into state, so `JSON.parse('null')` set the context to null and the provider's
 * own `Boolean(tableContext.tableId)` threw during render — a case the catch never saw, because
 * nothing about it throws. The ignore was right; what it guarded was wrong. That is the general
 * shape worth carrying: **a catch is a claim about the line above it, and "deliberate" is a claim
 * about intent, not evidence that the ignore is correct.**
 *
 * Slice 8 also removed three catches that could not fire at all — `useFeaturedSpecial` (its
 * producer resolves `{success:true, data:null}` by contract), `ServerDiagnosticsSection`'s
 * timestamp guard (`toLocaleTimeString()` returns "Invalid Date"; it does not throw, so the raw
 * -string fallback was unreachable and the words "Invalid Date" reached a cashier's screen), and
 * `useOrders.fetchAll` (both its callees swallowed, so a failed FIRST load showed an empty order
 * list with no message at all). A dead catch is worse than none: it tells the next reader the
 * failure is handled below when it is handled above, or not at all.
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
