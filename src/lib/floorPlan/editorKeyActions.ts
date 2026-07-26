import type { FloorPlanDocument } from '@/types/floorPlan';
import { patchMovable } from './document';
import { clampCentreToPlan } from './editorGeometry';
import { documentMovables, selectedMovables, type Movable } from './movable';
import { snapAngle } from './snapping';

/**
 * What the editor's keys actually *do* (FLOOR-PLAN-REVAMP §4.3), separated from
 * the listener that dispatches them ({@link ../../hooks/floorPlan/useEditorKeyboard}).
 * Each one is a pure document transform or a plain decision, so "Shift+arrow
 * nudges ten grid units" and "Delete asks before removing a table" are unit-
 * testable without dispatching a `KeyboardEvent` at a window.
 */

/** Which way each arrow key moves the selection. */
export const NUDGE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Typing in an inspector field is not editing the plan — those keys are the input's. */
export const isFormField = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * Nudge everything selected by one grid unit (ten with Shift). Each object is
 * clamped to the plan on its own, like the drag path, so a nudge can't push
 * something off-plan into a spot Save would silently move it back from.
 */
export function nudgeSelection(
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

/**
 * What Delete means for this selection. Items are local edits, so any number of
 * them goes at once; a table is a /api/tables lifecycle op and always has to be
 * confirmed — so a mixed selection loses its items and keeps its table, rather
 * than one Delete meaning two different things.
 */
export function deleteIntent(doc: FloorPlanDocument, selectedIds: readonly string[]): 'items' | 'table' | 'none' {
  const picked = selectedMovables(doc, selectedIds);
  if (picked.some((m) => m.target === 'item')) {
    return 'items';
  }
  return picked.length === 1 ? 'table' : 'none';
}

/**
 * The rotation a key produces for the one selected object, or null when the key
 * is not a rotation key: `[` / `]` step ∓15° (Shift = ∓90°) and `0` resets.
 */
export function rotationForKey(key: string, shift: boolean, movable: Movable): number | null {
  if (key === '[' || key === ']') {
    const delta = (key === '[' ? -1 : 1) * (shift ? 90 : 15);
    return snapAngle(movable.rotationDegrees + delta, 1);
  }
  return key === '0' ? 0 : null;
}
