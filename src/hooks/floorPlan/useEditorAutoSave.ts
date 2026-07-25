'use client';

import { useEffect, useRef, useState } from 'react';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** Quiet period after the last edit before an autosave fires. */
export const AUTOSAVE_IDLE_MS = 1500;
/** Longest an edit may sit unsaved while the admin keeps working without pausing. */
export const AUTOSAVE_MAX_WAIT_MS = 10_000;
/** Consecutive failures after which autosave stops and says so. */
export const AUTOSAVE_MAX_FAILURES = 3;

interface EditorAutoSaveArgs {
  /** The live document; a new reference means a new History entry to persist. */
  document: FloorPlanDocument | null;
  dirty: boolean;
  saving: boolean;
  /** A 409 latch — the plan moved under us, so retrying would only hammer the API. */
  conflicted: boolean;
  /** `useEditorSave`'s silent path. Resolves false when the save did not land. */
  save: (options?: { silent?: boolean }) => Promise<boolean>;
}

/**
 * Autosaves the floor-plan editor (FLOOR-PLAN-REVAMP §4.3). Before this, geometry
 * edits lived only in the browser until an explicit Save, and the toolbar disabled
 * "Add table" while dirty to keep a lifecycle op from racing the unsaved document —
 * so a crash, a closed laptop or a stray reload dropped the whole session's layout
 * work, and the admin hit a dead button with no explanation.
 *
 * **Idle debounce plus a max wait, not a change counter.** Each History entry is one
 * intent (a drag commits once, on pointer-up), so counting is tempting — but "every
 * N edits" saves at an arbitrary point mid-task and stays silent through a long
 * pause, which is exactly when a save matters. Waiting for {@link AUTOSAVE_IDLE_MS}
 * of quiet saves at a natural boundary instead, and {@link AUTOSAVE_MAX_WAIT_MS}
 * caps how much continuous editing can be lost.
 *
 * The last edit before a crash can still be lost — this shortens the window from a
 * whole session to seconds, it does not close it.
 *
 * Returns `stalled`: autosave has given up (a conflict, or {@link AUTOSAVE_MAX_FAILURES}
 * failures in a row) and the manual Save is now the only way through. The toolbar has
 * to say so — an editor that silently stopped saving is worse than one that never did.
 */
export function useEditorAutoSave({ document, dirty, saving, conflicted, save }: EditorAutoSaveArgs) {
  // Refs, not deps: `save` changes identity whenever the concurrency token does,
  // and re-running this effect on that would restart the debounce after every save.
  const saveRef = useRef(save);
  saveRef.current = save;
  /** When the current run of unsaved edits began — the max-wait deadline's origin. */
  const dirtySince = useRef<number | null>(null);
  /**
   * Consecutive failed attempts. The conflict latch only covers 409; without this,
   * a backend 500, a dropped connection or an expired admin session left the editor
   * PUTting every couple of seconds, and re-raising the error banner each time, for
   * as long as the tab stayed open.
   */
  const failures = useRef(0);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!dirty) {
      // Something landed — this save, or the toolbar's. The network works, so a fresh
      // run of edits gets a fresh allowance and the stall (if any) is over.
      dirtySince.current = null;
      failures.current = 0;
      setStalled(false);
      return;
    }
    if (conflicted || failures.current >= AUTOSAVE_MAX_FAILURES) {
      dirtySince.current = null;
      setStalled(true);
      return;
    }
    // A save in flight already covers the current document; the `dirty` flip when it
    // lands (or the next edit) re-runs this effect, so nothing is left unscheduled.
    if (saving) {
      return;
    }
    const now = Date.now();
    dirtySince.current ??= now;
    const untilDeadline = dirtySince.current + AUTOSAVE_MAX_WAIT_MS - now;
    const timer = setTimeout(
      () => {
        dirtySince.current = null;
        void saveRef.current({ silent: true }).then((ok) => {
          failures.current = ok ? 0 : failures.current + 1;
        });
      },
      Math.max(0, Math.min(AUTOSAVE_IDLE_MS, untilDeadline)),
    );
    return () => clearTimeout(timer);
    // `document` is here purely as the change signal — a new History entry is a new
    // reference, which is what restarts the idle debounce. Its contents are never read.
  }, [document, dirty, saving, conflicted]);

  return { stalled };
}
