'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSetupChecklist, setSetupChecklistDismissed, setSetupStepDone } from '@/services/setupChecklistService';
import type { SetupChecklistDto } from '@/types/setupChecklist';

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
 * the re-read overrules it either way, now with `saveFailed` to explain a refusal.
 *
 * There is no module-scope cache like `useRestaurantInfo`'s: this renders on exactly
 * one page, for one admin, and the answer changes as they work through it.
 */
export interface UseSetupChecklistResult {
  checklist: SetupChecklistDto | null;
  isLoading: boolean;
  /** True while a mutation is in flight — the UI disables its controls. */
  isSaving: boolean;
  /** The last write failed. Survives the re-read that follows it. */
  saveFailed: boolean;
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
  const [saveFailed, setSaveFailed] = useState(false);
  const [pending, setPending] = useState<{ key: string; isDone: boolean } | null>(null);
  // Read inside `load` without making it depend on `checklist`, which would rebuild
  // the callback on every fetch and re-fire the mount effect.
  const lastGood = useRef<SetupChecklistDto | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getSetupChecklist();
      const data = response?.data ?? null;
      lastGood.current = data;
      setChecklist(data);
    } catch {
      // Keep the last good copy rather than blanking the panel. A checklist that has
      // rendered once must not vanish over one failed refresh — and after a rejected
      // write, dropping it here would take the error message down with it, since the
      // component renders nothing without a checklist.
      //
      // Only the FIRST read failing leaves null, which renders nothing at all. That is
      // deliberate: an empty list reads as "you are all done", the one wrong answer on
      // a surface whose job is saying what is left.
      setChecklist(lastGood.current);
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
   * `saveFailed` is separate from the read on purpose. Folding both into one flag meant
   * the follow-up GET succeeding immediately cleared the message, so a rejected write
   * (the API answers 400 for a derived step) flashed for one round-trip and then said
   * nothing at all: the owner saw a checkbox snap back with no explanation.
   */
  const mutate = useCallback(
    async (action: () => Promise<unknown>, optimistic: { key: string; isDone: boolean } | null) => {
      setIsSaving(true);
      setSaveFailed(false);
      setPending(optimistic);
      try {
        await action();
      } catch {
        setSaveFailed(true);
      } finally {
        // Re-read either way: a rejected write leaves the server state unchanged, and
        // the local copy may already be stale from another tab or another admin. Clear
        // `pending` only AFTER it lands, so the checkbox never flickers back through
        // the old value on its way to the new one.
        await load();
        setPending(null);
        setIsSaving(false);
      }
    },
    [load],
  );

  const setStepDone = useCallback(
    (key: string, isDone: boolean) => mutate(() => setSetupStepDone(key, isDone), { key, isDone }),
    [mutate],
  );

  const setDismissed = useCallback(
    (isDismissed: boolean) => mutate(() => setSetupChecklistDismissed(isDismissed), null),
    [mutate],
  );

  return {
    checklist,
    isLoading,
    isSaving,
    saveFailed,
    pending,
    setStepDone,
    setDismissed,
    refetch: load,
  };
}
