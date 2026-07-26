'use client';

import { useEffect } from 'react';
import { patchMovable } from '@/lib/floorPlan/document';
import { toolForKey, type EditorTool } from '@/lib/floorPlan/editorTools';
import {
  NUDGE_KEYS,
  deleteIntent,
  isFormField,
  nudgeSelection,
  rotationForKey,
} from '@/lib/floorPlan/editorKeyActions';
import { findMovable } from '@/lib/floorPlan/movable';
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
  /** `V` / `W` — switch tool (§4.3's single-key shortcuts). */
  onSelectTool: (tool: EditorTool) => void;
}

/**
 * The ⌘/Ctrl shortcuts: undo/redo and duplicate. Returns whether one fired, so
 * the dispatcher stays a flat list of "did this claim the key?" questions.
 */
function applyCommandKey(
  e: globalThis.KeyboardEvent,
  { undo, redo, onDuplicate }: Pick<EditorKeyboardArgs, 'undo' | 'redo' | 'onDuplicate'>,
): boolean {
  const key = e.key.toLowerCase();
  if (key === 'z') {
    e.preventDefault();
    (e.shiftKey ? redo : undo)();
    return true;
  }
  if (key === 'd') {
    // Browsers bookmark on ⌘D, so this must be prevented whether or not the
    // selection has anything duplicable in it.
    e.preventDefault();
    onDuplicate();
    return true;
  }
  return false;
}

/**
 * Keyboard control for the editor (FLOOR-PLAN-REVAMP §4.3) — the no-drag path
 * that keeps the whole tool operable without a pointer. `V` / `W` switch tool;
 * arrows nudge **every** selected object one grid unit (Shift = ten), so a group
 * moves from the keyboard exactly as it does from a drag; `[` / `]` rotate ∓15°
 * (Shift = ∓90°) and `0` resets, both single-selection only (a group rotation
 * about a shared centre is a different operation); `Esc` clears the selection (or
 * disarms the palette); `⌘D` duplicates selected items; Delete removes items
 * outright and *asks* before deleting a table; ⌘/Ctrl-Z / -Shift-Z undo/redo.
 * Keys are ignored while a form field is focused so the inspector's inputs keep
 * their native editing. What each key *does* lives in
 * {@link ../../lib/floorPlan/editorKeyActions}; this hook only dispatches.
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
  onSelectTool,
}: EditorKeyboardArgs) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const only = selectedIds.length === 1 ? findMovable(doc, selectedIds[0]) : null;

    /** Each claim answers one question: "is this key mine?" — flat, not nested. */
    const claimNudge = (e: globalThis.KeyboardEvent): boolean => {
      const nudge = NUDGE_KEYS[e.key];
      if (!nudge || selectedIds.length === 0) {
        return false;
      }
      e.preventDefault();
      apply(nudgeSelection(doc, selectedIds, nudge, (doc.gridSizeCm / 100) * (e.shiftKey ? 10 : 1)));
      return true;
    };

    const claimDelete = (e: globalThis.KeyboardEvent): boolean => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return false;
      }
      e.preventDefault();
      const intent = deleteIntent(doc, selectedIds);
      if (intent === 'items') {
        onDeleteItems();
      } else if (intent === 'table') {
        onDeleteSelected();
      }
      return true;
    };

    const claimTool = (e: globalThis.KeyboardEvent): boolean => {
      // Bare letter only: `⌘V` is paste and `Ctrl+W` closes the tab, so a tool
      // must never answer a modified key.
      const tool = e.metaKey || e.ctrlKey || e.altKey ? null : toolForKey(e.key);
      if (!tool) {
        return false;
      }
      e.preventDefault();
      onSelectTool(tool);
      return true;
    };

    const claimRotation = (e: globalThis.KeyboardEvent): boolean => {
      if (!only) {
        return false;
      }
      // `0` is a legitimate result (reset), so this compares against null rather
      // than testing truthiness.
      const rotation = rotationForKey(e.key, e.shiftKey, only);
      if (rotation === null) {
        return false;
      }
      e.preventDefault();
      apply(patchMovable(doc, only.id, { rotationDegrees: rotation }));
      return true;
    };

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (isFormField(e.target)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && applyCommandKey(e, { undo, redo, onDuplicate })) {
        return;
      }
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }
      for (const claim of [claimNudge, claimDelete, claimTool, claimRotation]) {
        if (claim(e)) {
          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    enabled,
    doc,
    selectedIds,
    apply,
    undo,
    redo,
    clearSelection,
    onDeleteSelected,
    onDeleteItems,
    onDuplicate,
    onSelectTool,
  ]);
}
