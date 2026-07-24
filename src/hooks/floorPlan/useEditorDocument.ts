'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFloorPlan, saveFloorPlan } from '@/services/floorPlanService';
import { ApiError } from '@/utils/apiClient';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  commit,
  initHistory,
  redo as redoOf,
  undo as undoOf,
  type History,
} from '@/lib/floorPlan/history';
import { updateTable } from '@/lib/floorPlan/document';

export type EditorStatus = 'loading' | 'ready' | 'error';
export type EditorMessage = { type: 'success' | 'error'; text: string } | null;

/**
 * The editor's document state machine (FLOOR-PLAN-REVAMP §4.3). Loads the plan
 * into an undo/redo History, tracks the selected table id, and owns the one
 * whole-document Save (PUT /api/floorplan; a 409 means someone else saved —
 * "reload"). Geometry edits are local until Save; `dirty` drives the unsaved-
 * changes guard. Table create/delete/QR stay on /api/tables (the caller's
 * modals) and come back through `reload`.
 */
export function useEditorDocument() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<History<FloorPlanDocument> | null>(null);
  const [saved, setSaved] = useState<FloorPlanDocument | null>(null);
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<EditorMessage>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  const present = history?.present ?? null;

  /** Push any new document onto the history (drag commit, inspector, keyboard). */
  const apply = useCallback((next: FloorPlanDocument) => {
    setHistory((h) => (h ? commit(h, next) : h));
  }, []);

  const mutateTable = useCallback((id: string, patch: Partial<FloorPlanTableGeometry>) => {
    setHistory((h) => (h ? commit(h, updateTable(h.present, id, patch)) : h));
  }, []);

  const undo = useCallback(() => setHistory((h) => (h ? undoOf(h) : h)), []);
  const redo = useCallback(() => setHistory((h) => (h ? redoOf(h) : h)), []);

  const reload = useCallback(() => {
    setSelectedId(null);
    setReloadKey((k) => k + 1);
  }, []);

  const save = useCallback(async () => {
    if (!present) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveFloorPlan(present.id, present);
      if (res.success && res.data) {
        setHistory(initHistory(res.data));
        setSaved(res.data);
        setMessage({ type: 'success', text: t('floor_plan_saved', 'Floor plan saved.') });
      } else {
        setMessage({ type: 'error', text: t('floor_plan_save_failed', 'Could not save the floor plan.') });
      }
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      setMessage({
        type: 'error',
        text: conflict
          ? t('floor_plan_save_conflict', 'Someone else changed the plan. Reload and try again.')
          : t('floor_plan_save_failed', 'Could not save the floor plan.'),
      });
    } finally {
      setSaving(false);
    }
  }, [present, t]);

  return {
    status,
    document: present,
    selectedId,
    select: setSelectedId,
    apply,
    mutateTable,
    undo,
    redo,
    canUndo: history ? canUndoOf(history) : false,
    canRedo: history ? canRedoOf(history) : false,
    dirty: Boolean(history && saved && history.present !== saved),
    saving,
    save,
    reload,
    message,
    clearMessage: useCallback(() => setMessage(null), []),
  };
}
