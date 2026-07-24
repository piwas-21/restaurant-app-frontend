'use client';

import { useEffect } from 'react';
import { updateTable } from '@/lib/floorPlan/document';
import { snapAngle } from '@/lib/floorPlan/snapping';
import { clampCentreToPlan } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';

interface EditorKeyboardArgs {
  enabled: boolean;
  document: FloorPlanDocument;
  /** The whole selection: arrows nudge all of it, the rest need exactly one. */
  selectedIds: readonly string[];
  apply: (doc: FloorPlanDocument) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  onDeleteSelected: () => void;
}

const NUDGE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const isFormField = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * Nudge every selected table by one grid unit (ten with Shift). Each is clamped
 * to the plan on its own, like the drag path, so a nudge can't push a table
 * off-plan into a spot Save would silently move it back from.
 */
function nudgeSelection(
  doc: FloorPlanDocument,
  ids: readonly string[],
  direction: readonly [number, number],
  step: number,
): FloorPlanDocument {
  return doc.tables.reduce((next, table) => {
    if (!ids.includes(table.id)) {
      return next;
    }
    const centre = clampCentreToPlan(table.positionX + direction[0] * step, table.positionY + direction[1] * step, doc);
    return updateTable(next, table.id, { positionX: centre.x, positionY: centre.y });
  }, doc);
}

/** Apply a key that edits the one selected table: rotate / reset / delete. */
function applyTableKey(
  e: globalThis.KeyboardEvent,
  doc: FloorPlanDocument,
  table: FloorPlanTableGeometry,
  apply: (doc: FloorPlanDocument) => void,
  onDeleteSelected: () => void,
): void {
  if (e.key === '[' || e.key === ']') {
    e.preventDefault();
    const delta = (e.key === '[' ? -1 : 1) * (e.shiftKey ? 90 : 15);
    apply(updateTable(doc, table.id, { rotation: snapAngle(table.rotation + delta, 1) }));
  } else if (e.key === '0') {
    e.preventDefault();
    apply(updateTable(doc, table.id, { rotation: 0 }));
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    onDeleteSelected();
  }
}

/**
 * Keyboard control for the editor (FLOOR-PLAN-REVAMP §4.3) — the no-drag path
 * that keeps the whole tool operable without a pointer. Arrows nudge **every**
 * selected table one grid unit (Shift = ten), so a group moves from the keyboard
 * exactly as it does from a drag; `[` / `]` rotate ∓15° (Shift = ∓90°) and `0`
 * resets, both single-selection only (a group rotation about a shared centre is
 * a different operation); `Esc` clears the selection; Delete asks to remove it;
 * ⌘/Ctrl-Z / -Shift-Z undo/redo. Keys are ignored while a form field is focused
 * so the inspector's inputs keep their native editing.
 */
export function useEditorKeyboard({
  enabled,
  document: doc,
  selectedIds,
  apply,
  undo,
  redo,
  clearSelection,
  onDeleteSelected,
}: EditorKeyboardArgs) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const only = selectedIds.length === 1 ? doc.tables.find((t) => t.id === selectedIds[0]) : undefined;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (isFormField(e.target)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
        return;
      }
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }
      const nudge = NUDGE_KEYS[e.key];
      if (nudge && selectedIds.length > 0) {
        e.preventDefault();
        apply(nudgeSelection(doc, selectedIds, nudge, (doc.gridSizeCm / 100) * (e.shiftKey ? 10 : 1)));
        return;
      }
      if (only) {
        applyTableKey(e, doc, only, apply, onDeleteSelected);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, doc, selectedIds, apply, undo, redo, clearSelection, onDeleteSelected]);
}
