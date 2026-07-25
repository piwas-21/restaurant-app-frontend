'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveFloorPlan } from '@/services/floorPlanService';
import { ApiError } from '@/utils/apiClient';
import type { FloorPlanDocument } from '@/types/floorPlan';

export type EditorMessage = { type: 'success' | 'error'; text: string } | null;

interface EditorSaveArgs {
  /** Reads the live document at call time — `save` runs from a debounce timer. */
  getDocument: () => FloorPlanDocument | null;
  /** The exact object that was sent, so the caller can clear `dirty` by reference. */
  onPersisted: (sent: FloorPlanDocument) => void;
}

/**
 * The editor's one write path: a whole-document `PUT /api/floorplan` (FLOOR-PLAN-REVAMP
 * §4.3). Split out of `useEditorDocument` so the store stays inside its 200-LOC limit
 * and so the save's own rules — concurrency token, conflict latch, silent autosave —
 * are testable on their own.
 *
 * **The concurrency token lives here, not in the document.** A save echoes the
 * `updatedAt` it loaded and the server hands back a new one; writing that back into
 * the undo history would mint a fresh object on every save, so `dirty` (a reference
 * compare) could never clear and the undo stack would collect token-only entries.
 *
 * **The response is read for the token only — the history is never re-initialised
 * from it.** It used to be, which discarded every undo step on each save: survivable
 * when saving was a once-per-session button press, unacceptable once it happens
 * automatically. Keeping the client's document authoritative is safe because the
 * editor clamps position and size to the same bounds the server does.
 */
export function useEditorSave({ getDocument, onPersisted }: EditorSaveArgs) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<EditorMessage>(null);
  /** A 409 means the plan moved under us; autosave must stop rather than hammer it. */
  const [conflicted, setConflicted] = useState(false);
  /**
   * The optimistic-concurrency token, in a **ref** so it is read at call time. As
   * render state it was captured by the save's closure, so `flush`'s second pass
   * re-sent the token the first pass had already consumed — a 409 against the
   * editor's own write, which latched `conflicted` and killed autosave for the
   * session. Nothing renders the token, so state buys nothing here.
   */
  const token = useRef<string | null>(null);
  /**
   * The save in flight, if any. A promise rather than a boolean because a caller
   * that needs the plan persisted (see `flush`) has to **wait** for it — being told
   * "no, one is already running" would report the document as unsaved when the
   * request covering it is a few hundred ms from landing.
   */
  const inFlight = useRef<Promise<boolean> | null>(null);
  /** The last document the server accepted, readable synchronously by `flush`. */
  const persisted = useRef<FloorPlanDocument | null>(null);

  /** Seed the token from a freshly loaded document (mount and reload). */
  const adoptToken = useCallback((doc: FloorPlanDocument) => {
    token.current = doc.updatedAt ?? null;
    setConflicted(false);
    persisted.current = doc;
  }, []);

  /**
   * Persist the current document. `silent` is the autosave path: same write, no
   * success banner — a toast every couple of seconds is noise, not feedback.
   * Resolves to whether the plan is now persisted, so a caller can flush before a
   * /api/tables lifecycle op rather than blocking the button until the user saves.
   */
  const run = useCallback(
    async (current: FloorPlanDocument, silent: boolean): Promise<boolean> => {
      setSaving(true);
      if (!silent) {
        setMessage(null);
      }
      try {
        const res = await saveFloorPlan(current.id, { ...current, updatedAt: token.current });
        if (res.success && res.data) {
          persisted.current = current;
          onPersisted(current);
          token.current = res.data.updatedAt ?? null;
          setConflicted(false);
          if (!silent) {
            setMessage({ type: 'success', text: t('floor_plan_saved', 'Floor plan saved.') });
          }
          return true;
        }
        setMessage({ type: 'error', text: t('floor_plan_save_failed', 'Could not save the floor plan.') });
        return false;
      } catch (err) {
        const conflict = err instanceof ApiError && err.status === 409;
        // A 400 carries the server's validation detail, and swallowing it is how a
        // contract mismatch (a client-minted id in a `Guid?` field) presented as an
        // unactionable "could not save". The banner stays localised — the detail goes
        // to the console, where the next such bug is one glance away.
        if (err instanceof ApiError && !conflict) {
          console.error('Floor plan save rejected', { status: err.status, message: err.message, errors: err.errors });
        }
        if (conflict) {
          setConflicted(true);
        }
        setMessage({
          type: 'error',
          text: conflict
            ? t('floor_plan_save_conflict', 'Someone else changed the plan. Reload and try again.')
            : t('floor_plan_save_failed', 'Could not save the floor plan.'),
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onPersisted, t],
  );

  const save = useCallback(
    ({ silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
      if (inFlight.current) {
        return inFlight.current;
      }
      const current = getDocument();
      if (!current) {
        return Promise.resolve(false);
      }
      // Assigned before the first await so a same-tick second call joins this one.
      const pending = run(current, silent).finally(() => {
        inFlight.current = null;
      });
      inFlight.current = pending;
      return pending;
    },
    [getDocument, run],
  );

  /**
   * Make sure the server has the caller's document, and report whether it does.
   * Used before a /api/tables lifecycle op, which ends in a reload that would
   * otherwise discard unsaved geometry — the case the editor used to handle by
   * disabling those buttons until the admin saved by hand.
   */
  const flush = useCallback(async () => {
    // Two passes at most. The first awaits (or starts) a save; the second covers an
    // edit made WHILE that save was in flight, which its request could not have
    // included. Bounded on purpose — a caller waiting on the network to open a modal
    // must not spin just because the admin keeps dragging.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (getDocument() === persisted.current) {
        return true;
      }
      if (!(await save({ silent: true }))) {
        return false;
      }
    }
    return getDocument() === persisted.current;
  }, [getDocument, save]);

  return { save, flush, saving, conflicted, message, setMessage, adoptToken };
}
