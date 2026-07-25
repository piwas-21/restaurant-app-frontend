'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFloorPlan } from '@/services/floorPlanService';
import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  commit,
  initHistory,
  redo as redoOf,
  undo as undoOf,
  type History,
} from '@/lib/floorPlan/history';
import { updateItem, updateTable } from '@/lib/floorPlan/document';
import { pruneSelection, toggleSelection } from '@/lib/floorPlan/selection';
import { useEditorSave } from './useEditorSave';

export type EditorStatus = 'loading' | 'ready' | 'error';
export type { EditorMessage } from './useEditorSave';

/**
 * The editor's document state machine (FLOOR-PLAN-REVAMP §4.3). Loads the plan
 * into an undo/redo History, tracks the selected table id, and owns the one
 * whole-document Save (PUT /api/floorplan; a 409 means someone else saved —
 * "reload"). Geometry edits persist on their own shortly after they are made (see
 * `useEditorAutoSave`); `dirty` is what drives that, plus the unsaved-changes guard
 * for the window in between. Table create/delete/QR stay on /api/tables (the
 * caller's modals) and come back through `reload`.
 */
export function useEditorDocument() {
  const [history, setHistory] = useState<History<FloorPlanDocument> | null>(null);
  const [saved, setSaved] = useState<FloorPlanDocument | null>(null);
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const historyRef = useRef(history);
  historyRef.current = history;

  // The write path (token, conflict latch, silent autosave) lives in useEditorSave.
  const { save, flush, saving, conflicted, message, setMessage, adoptToken } = useEditorSave({
    getDocument: () => historyRef.current?.present ?? null,
    onPersisted: setSaved,
  });

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getFloorPlan()
      .then((res) => {
        if (!active) {
          return;
        }
        if (res.success && res.data) {
          setHistory(initHistory(res.data));
          setSaved(res.data);
          adoptToken(res.data);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
    // `adoptToken` is stable (useCallback, no deps) and keying this effect on
    // reloadKey alone is what keeps an unrelated re-render from re-fetching the plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const present = history?.present ?? null;

  /** Push any new document onto the history (drag commit, inspector, keyboard). */
  const apply = useCallback((next: FloorPlanDocument) => {
    setHistory((h) => (h ? commit(h, next) : h));
  }, []);

  const mutateTable = useCallback((id: string, patch: Partial<FloorPlanTableGeometry>) => {
    setHistory((h) => (h ? commit(h, updateTable(h.present, id, patch)) : h));
  }, []);

  const mutateItem = useCallback((id: string, patch: Partial<FloorPlanItem>) => {
    setHistory((h) => (h ? commit(h, updateItem(h.present, id, patch)) : h));
  }, []);

  /** Click selects one object; shift-click adds to / removes from the selection. */
  const select = useCallback(
    (id: string, additive = false) => setSelectedIds((ids) => toggleSelection(ids, id, additive)),
    [],
  );
  const selectMany = useCallback((ids: string[]) => setSelectedIds(ids), []);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const undo = useCallback(() => setHistory((h) => (h ? undoOf(h) : h)), []);
  const redo = useCallback(() => setHistory((h) => (h ? redoOf(h) : h)), []);

  const reload = useCallback(() => {
    setSelectedIds([]);
    setReloadKey((k) => k + 1);
  }, []);

  // Undo can bring an object back and a reload re-mints every item id (a lifecycle
  // op, or recovering from a conflict), so the selection is filtered against the live
  // document rather than trusted. Memoised because it is a dependency of the keyboard
  // listener and the align callbacks — a fresh array each render would re-subscribe
  // them on every pointer move.
  const liveIds = useMemo(() => (present ? pruneSelection(selectedIds, present) : []), [present, selectedIds]);

  return {
    status,
    document: present,
    selectedIds: liveIds,
    /** The single selection, or null when zero or several are picked. */
    selectedId: liveIds.length === 1 ? liveIds[0] : null,
    select,
    selectMany,
    clearSelection,
    apply,
    mutateTable,
    mutateItem,
    undo,
    redo,
    canUndo: history ? canUndoOf(history) : false,
    canRedo: history ? canRedoOf(history) : false,
    dirty: Boolean(history && saved && history.present !== saved),
    saving,
    save,
    /** Persist anything outstanding before a /api/tables op that ends in a reload. */
    flush,
    reload,
    /** True after a 409 — the plan moved under us and only a reload can resolve it. */
    conflicted,
    message,
    clearMessage: useCallback(() => setMessage(null), [setMessage]),
  };
}
