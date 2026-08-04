'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSetupChecklist, setSetupChecklistDismissed, setSetupStepDone } from '@/services/setupChecklistService';
import type { SetupChecklistDto } from '@/types/setupChecklist';
import { useTranslation } from 'react-i18next';
import { useApiError } from '@/hooks/useApiError';

/**
 * The tenant's first-run setup checklist (SOFRA-ONBOARDING-PLAN O4).
 *
 * The server is authoritative for every step's state — two of them are DERIVED, done
 * when the data says so, and the API refuses to acknowledge those at all. So a write is
 * always followed by a re-read, and it is the re-read that decides.
 *
 * The one thing held locally is the step currently being written (`pending`). Without
 * it the checkbox is a controlled input bound to server state: clicking it toggles,
 * React immediately re-renders it back to the old value, and it visibly un-ticks for
 * the whole round-trip before re-ticking. Watching a box you just ticked jump back is
 * indistinguishable from the save failing. This is safe to hold optimistically because
 * it only ever covers ACKNOWLEDGED steps — derived steps have no control to click — and
 * the re-read overrules it either way, now with `saveError` to explain a refusal.
 *
 * There is no module-scope cache like `useRestaurantInfo`'s: this renders on exactly
 * one page, for one admin, and the answer changes as they work through it.
 */
export interface UseSetupChecklistResult {
  checklist: SetupChecklistDto | null;
  isLoading: boolean;
  /** True while a mutation is in flight — the UI disables its controls. */
  isSaving: boolean;
  /**
   * Why the last write failed, ready to render — the server's own sentence when the 400 carried
   * one, the translated generic otherwise. `null` when nothing is wrong. Survives the re-read
   * that follows it.
   */
  saveError: string | null;
  /** The step being written right now and the value being written, or null. */
  pending: { key: string; isDone: boolean } | null;
  setStepDone: (key: string, isDone: boolean) => Promise<void>;
  setDismissed: (isDismissed: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSetupChecklist(): UseSetupChecklistResult {
  const [checklist, setChecklist] = useState<SetupChecklistDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();
  const saveError = useApiError();
  const [pending, setPending] = useState<{ key: string; isDone: boolean } | null>(null);
  // Read inside `load` without making it depend on `checklist`, which would rebuild
  // the callback on every fetch and re-fire the mount effect.
  const lastGood = useRef<SetupChecklistDto | null>(null);

  /**
   * Returns whether the read landed, so a CALLER can decide what to do about a failure — which is
   * the whole of #416. This catch stays silent AND unbound (see below), but "silent" and
   * "unreported" are different things, and only `mutate` knows whether a message is already showing.
   *
   * A boolean rather than the error: `mutate` deliberately does not render the read failure's own
   * words (see there), so carrying them would be a value nothing may use — and a `catch (error)`
   * that binds without surfacing is precisely what the E9 ratchet's guidance calls out as satisfying
   * the gate while fixing nothing.
   */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const response = await getSetupChecklist();
      const data = response?.data ?? null;
      lastGood.current = data;
      setChecklist(data);
      return true;
    } catch {
      // Keep the last good copy rather than blanking the panel. A checklist that has
      // rendered once must not vanish over one failed refresh — and after a rejected
      // write, dropping it here would take the error message down with it, since the
      // component renders nothing without a checklist.
      //
      // Only the FIRST read failing leaves null, which renders nothing at all. That is
      // deliberate: an empty list reads as "you are all done", the one wrong answer on
      // a surface whose job is saying what is left.
      //
      // Still nothing reported FROM HERE, and that is the point: a rejected write has already put
      // the server's own sentence in `saveError` — the 400 for a derived step explains the
      // snap-back — and touching it here would replace the specific reason with a generic one.
      //
      // #416 was the third path: write SUCCEEDS, this re-read fails. `saveError` was cleared on
      // entry, nothing captured the read failure, and `setPending(null)` ran in the caller's
      // `finally` — so the owner ticked a step, the server recorded it, and the checkbox snapped
      // back unchecked with no error at all. Same shape as the `saveFailed` boolean #388 fixed in
      // this very file. Reporting it is now `mutate`'s job, which is the only place that knows
      // whether a write message is already showing.
      setChecklist(lastGood.current);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Run a mutation, then re-read — the server owns every step's real state.
   *
   * `saveError` is separate from the read on purpose. Folding both into one flag meant
   * the follow-up GET succeeding immediately cleared the message, so a rejected write
   * (the API answers 400 for a derived step) flashed for one round-trip and then said
   * nothing at all: the owner saw a checkbox snap back with no explanation.
   *
   * It was a BOOLEAN until E9 step 3 (#383), which is the other half of the same story. The
   * 400 for a derived step carries a sentence saying it is derived — the one thing that
   * explains the snap-back — and a boolean threw it away, leaving the same generic line for
   * every cause. `load`'s own catch stays bare and unbound on purpose (see there); it must
   * not touch this state, which is what keeps the write's message up across the re-read.
   */
  const mutate = useCallback(
    async (action: () => Promise<unknown>, optimistic: { key: string; isDone: boolean } | null) => {
      setIsSaving(true);
      saveError.clear();
      setPending(optimistic);
      let wrote = false;
      try {
        await action();
        wrote = true;
      } catch (err) {
        saveError.capture(err, { fallback: t('setup_checklist_save_failed', 'Could not save that change') });
      } finally {
        // Re-read either way: a rejected write leaves the server state unchanged, and
        // the local copy may already be stale from another tab or another admin. Clear
        // `pending` only AFTER it lands, so the checkbox never flickers back through
        // the old value on its way to the new one.
        const reloaded = await load();

        // #416. Report a failed re-read ONLY when the write itself succeeded. On a rejected write
        // `saveError` already holds the server's reason, which is the more specific of the two, and
        // overwriting it would undo what #388 and E9 step 3 fixed here.
        //
        // `show`, not `capture`: the load error's own words would say the fetch failed, which is
        // true and misleading. The fact that matters is that the change WAS saved — otherwise the
        // owner reads a snapped-back checkbox plus "could not load" and reasonably concludes it did
        // not stick, and ticks it again.
        if (wrote && !reloaded) {
          saveError.show(
            t(
              'setup_checklist_refresh_failed',
              'Saved. The checklist could not be refreshed — reload to see the latest.',
            ),
          );
        }
        setPending(null);
        setIsSaving(false);
      }
    },
    [load, saveError, t],
  );

  const setStepDone = useCallback(
    (key: string, isDone: boolean) => mutate(() => setSetupStepDone(key, isDone), { key, isDone }),
    [mutate],
  );

  const setDismissed = useCallback(
    (isDismissed: boolean) => mutate(() => setSetupChecklistDismissed(isDismissed), null),
    [mutate],
  );

  /**
   * `load` narrowed to the `Promise<void>` this hook promises — its boolean is `mutate`'s business,
   * not a caller's.
   *
   * Memoised, and that is not decoration: `load` itself is `useCallback(…, [])`, so exposing a fresh
   * arrow here would hand every consumer a value that changes each render, and one
   * `useEffect(…, [refetch])` would then refetch forever. The same footgun `useApiError` memoises
   * its whole object to avoid.
   */
  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return {
    checklist,
    isLoading,
    isSaving,
    saveError: saveError.message,
    pending,
    setStepDone,
    setDismissed,
    refetch,
  };
}
