'use client';

import { useEffect } from 'react';
import { patchMovable } from '@/lib/floorPlan/document';
import { snapAngle } from '@/lib/floorPlan/snapping';
import { clampCentreToPlan } from '@/lib/floorPlan/editorGeometry';
import { documentMovables, findMovable, selectedMovables, type Movable } from '@/lib/floorPlan/movable';
import type { FloorPlanDocument } from '@/types/floorPlan';

interface EditorKeyboardArgs {
  enabled: boolean;
  document: FloorPlanDocument;
  /** The whole selection: arrows nudge all of it, the rest need exactly one. */
  selectedIds: readonly string[];
  apply: (doc: FloorPlanDocument) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  /** Ask to delete the selected TABLE (a /api/tables op, so it needs a modal). */
  onDeleteSelected: () => void;
  /** Delete the selected ITEMS, which are local document edits until Save. */
  onDeleteItems: () => void;
  /** ⌘D — duplicate the selected items (tables cannot be created locally). */
  onDuplicate: () => void;
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
 * Nudge everything selected by one grid unit (ten with Shift). Each object is
 * clamped to the plan on its own, like the drag path, so a nudge can't push
 * something off-plan into a spot Save would silently move it back from.
 */
function nudgeSelection(
  doc: FloorPlanDocument,
  ids: readonly string[],
  direction: readonly [number, number],
  step: number,
): FloorPlanDocument {
  return documentMovables(doc).reduce((next, movable) => {
    if (!ids.includes(movable.id)) {
      return next;
    }
    const centre = clampCentreToPlan(movable.x + direction[0] * step, movable.y + direction[1] * step, doc);
    return patchMovable(next, movable.id, { x: centre.x, y: centre.y });
  }, doc);
}

/** Apply a rotation key to the one selected object: ∓15° / ∓90° / reset. */
function applyRotationKey(
  e: globalThis.KeyboardEvent,
  doc: FloorPlanDocument,
  movable: Movable,
  apply: (doc: FloorPlanDocument) => void,
): void {
  if (e.key === '[' || e.key === ']') {
    e.preventDefault();
    const delta = (e.key === '[' ? -1 : 1) * (e.shiftKey ? 90 : 15);
    apply(patchMovable(doc, movable.id, { rotationDegrees: snapAngle(movable.rotationDegrees + delta, 1) }));
  } else if (e.key === '0') {
    e.preventDefault();
    apply(patchMovable(doc, movable.id, { rotationDegrees: 0 }));
  }
}

/**
 * Keyboard control for the editor (FLOOR-PLAN-REVAMP §4.3) — the no-drag path
 * that keeps the whole tool operable without a pointer. Arrows nudge **every**
 * selected object one grid unit (Shift = ten), so a group moves from the keyboard
 * exactly as it does from a drag; `[` / `]` rotate ∓15° (Shift = ∓90°) and `0`
 * resets, both single-selection only (a group rotation about a shared centre is
 * a different operation); `Esc` clears the selection (or disarms the palette);
 * `⌘D` duplicates selected items; Delete removes items outright and *asks* before
 * deleting a table; ⌘/Ctrl-Z / -Shift-Z undo/redo. Keys are ignored while a form
 * field is focused so the inspector's inputs keep their native editing.
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
  onDeleteItems,
  onDuplicate,
}: EditorKeyboardArgs) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const only = selectedIds.length === 1 ? findMovable(doc, selectedIds[0]) : null;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (isFormField(e.target)) {
        return;
      }
      const command = e.metaKey || e.ctrlKey;
      if (command && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
        return;
      }
      if (command && e.key.toLowerCase() === 'd') {
        // Browsers bookmark on ⌘D, so this must be prevented whether or not the
        // selection has anything duplicable in it.
        e.preventDefault();
        onDuplicate();
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // Items are local edits, so any number of them goes at once. A table is a
        // /api/tables lifecycle op and always has to be confirmed — so a mixed
        // selection loses its items and keeps its table, rather than one Delete
        // meaning two different things.
        const picked = selectedMovables(doc, selectedIds);
        if (picked.some((m) => m.target === 'item')) {
          onDeleteItems();
        } else if (picked.length === 1) {
          onDeleteSelected();
        }
        return;
      }
      if (only) {
        applyRotationKey(e, doc, only, apply);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, doc, selectedIds, apply, undo, redo, clearSelection, onDeleteSelected, onDeleteItems, onDuplicate]);
}
