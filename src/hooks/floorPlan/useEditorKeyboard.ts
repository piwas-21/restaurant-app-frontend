'use client';

import { useEffect } from 'react';
import { updateTable } from '@/lib/floorPlan/document';
import { snapAngle } from '@/lib/floorPlan/snapping';
import { clampCentreToPlan } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';

interface EditorKeyboardArgs {
  enabled: boolean;
  document: FloorPlanDocument;
  selectedId: string | null;
  apply: (doc: FloorPlanDocument) => void;
  undo: () => void;
  redo: () => void;
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

/** Apply a key that edits the selected table: nudge / rotate / reset / delete. */
function applyTableKey(
  e: globalThis.KeyboardEvent,
  doc: FloorPlanDocument,
  table: FloorPlanTableGeometry,
  apply: (doc: FloorPlanDocument) => void,
  onDeleteSelected: () => void,
): void {
  const nudge = NUDGE_KEYS[e.key];
  if (nudge) {
    e.preventDefault();
    const step = (doc.gridSizeCm / 100) * (e.shiftKey ? 10 : 1);
    // Clamp to the plan like the drag path, so a nudge can't push a table
    // off-plan into a spot Save would silently move it back from.
    const centre = clampCentreToPlan(table.positionX + nudge[0] * step, table.positionY + nudge[1] * step, doc);
    apply(updateTable(doc, table.id, { positionX: centre.x, positionY: centre.y }));
  } else if (e.key === '[' || e.key === ']') {
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
 * that keeps the whole tool operable without a pointer. Arrows nudge the
 * selected table one grid unit (Shift = ten); `[` / `]` rotate ∓15° (Shift =
 * ∓90°); `0` resets rotation; Delete asks to remove it; ⌘/Ctrl-Z / -Shift-Z
 * undo/redo. Keys are ignored while a form field is focused so the inspector's
 * inputs keep their native editing.
 */
export function useEditorKeyboard({
  enabled,
  document: doc,
  selectedId,
  apply,
  undo,
  redo,
  onDeleteSelected,
}: EditorKeyboardArgs) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const table = selectedId ? doc.tables.find((t) => t.id === selectedId) : undefined;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (isFormField(e.target)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
        return;
      }
      if (table) {
        applyTableKey(e, doc, table, apply, onDeleteSelected);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, doc, selectedId, apply, undo, redo, onDeleteSelected]);
}
