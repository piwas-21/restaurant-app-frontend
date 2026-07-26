import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';
import { clampCentreToPlan } from './editorGeometry';
import type { Gesture, GestureResult } from './editorGestures';
import { findMovable, selectedMovables, tableGeometryPatch, type MovableGeometry } from './movable';

/**
 * Immutable editor operations on a floor-plan document (FLOOR-PLAN-REVAMP §4.3,
 * §5.3). Every op returns a NEW document, sharing untouched arrays, so the
 * undo/redo stack ({@link ./history}) can hold whole snapshots cheaply and a
 * prior state is never mutated. Callers assign ids for created items (the editor
 * mints a client id until Save persists the server id). Pure and unit-tested.
 */

/**
 * A blank plan, so the editor's hooks can run unconditionally while the real one
 * loads. Its dimensions are §4.1's default room, which is what a plan the server
 * has never seen would be created as — a zero-sized placeholder would make the
 * viewport divide by zero before the first fetch resolves.
 */
export const EMPTY_DOCUMENT: FloorPlanDocument = {
  id: '',
  name: '',
  widthMeters: 12,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: '',
  isDefault: true,
  displayOrder: 0,
  updatedAt: null,
  walls: [],
  items: [],
  tables: [],
};

type Identified = { id?: string };

/** Patch the entry with the given id in a list, sharing the rest by reference. */
const patchById = <T extends Identified>(list: T[], id: string, patch: Partial<T>): T[] =>
  list.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));

/** Drop the entry with the given id from a list. */
const dropById = <T extends Identified>(list: T[], id: string): T[] => list.filter((entry) => entry.id !== id);

/** Patch a table's geometry by id, leaving others untouched. */
export function updateTable(
  doc: FloorPlanDocument,
  id: string,
  patch: Partial<FloorPlanTableGeometry>,
): FloorPlanDocument {
  return { ...doc, tables: patchById(doc.tables, id, patch) };
}

/** Patch an item by id. */
export function updateItem(doc: FloorPlanDocument, id: string, patch: Partial<FloorPlanItem>): FloorPlanDocument {
  return { ...doc, items: patchById(doc.items, id, patch) };
}

export function addItem(doc: FloorPlanDocument, item: FloorPlanItem): FloorPlanDocument {
  return { ...doc, items: [...doc.items, item] };
}

export function removeItem(doc: FloorPlanDocument, id: string): FloorPlanDocument {
  return { ...doc, items: dropById(doc.items, id) };
}

/** Drop every item named by `ids` in one edit — one history entry per Delete. */
export function removeItems(doc: FloorPlanDocument, ids: readonly string[]): FloorPlanDocument {
  const kept = doc.items.filter((item) => !item.id || !ids.includes(item.id));
  return kept.length === doc.items.length ? doc : { ...doc, items: kept };
}

/**
 * Patch a movable's geometry by id, whichever collection holds it — the one write
 * path a drag, a nudge, a grip and the inspector all share. A table's patch is
 * translated into its own field names ({@link tableGeometryPatch}); an item's
 * already uses them. An unknown id leaves the document untouched.
 */
export function patchMovable(doc: FloorPlanDocument, id: string, patch: Partial<MovableGeometry>): FloorPlanDocument {
  const movable = findMovable(doc, id);
  if (!movable) {
    return doc;
  }
  return movable.target === 'table' ? updateTable(doc, id, tableGeometryPatch(patch)) : updateItem(doc, id, patch);
}

/** Patch a wall by id. */
export function updateWall(doc: FloorPlanDocument, id: string, patch: Partial<FloorPlanWall>): FloorPlanDocument {
  return { ...doc, walls: patchById(doc.walls, id, patch) };
}

export function addWall(doc: FloorPlanDocument, wall: FloorPlanWall): FloorPlanDocument {
  return { ...doc, walls: [...doc.walls, wall] };
}

export function removeWall(doc: FloorPlanDocument, id: string): FloorPlanDocument {
  return { ...doc, walls: dropById(doc.walls, id) };
}

/** Set the room dimensions (space is added/removed at the right/bottom; §4.1). */
export function setPlanSize(doc: FloorPlanDocument, widthMeters: number, heightMeters: number): FloorPlanDocument {
  return { ...doc, widthMeters, heightMeters };
}

/**
 * Apply a resolved gesture to the document. The grabbed object takes the patch;
 * for a **move**, every other selected object travels by the same delta so a
 * multi-selection keeps its shape. Followers are clamped to the plan
 * individually — the same thing the server does — so dragging a group into a
 * corner squashes it against the wall rather than pushing things off-plan.
 * Rotate and resize stay single-object: a group rotation about a shared centre is
 * a different operation, and is not part of this slice.
 */
export function applyGesture(
  doc: FloorPlanDocument,
  gesture: Gesture,
  result: GestureResult,
  selectedIds: readonly string[],
): FloorPlanDocument {
  const primary = findMovable(doc, gesture.id);
  const next = patchMovable(doc, gesture.id, result.patch);
  if (gesture.kind !== 'move' || !primary) {
    return next;
  }
  const dx = (result.patch.x ?? primary.x) - primary.x;
  const dy = (result.patch.y ?? primary.y) - primary.y;
  return selectedMovables(doc, selectedIds).reduce((acc, follower) => {
    if (follower.id === gesture.id) {
      return acc;
    }
    const centre = clampCentreToPlan(follower.x + dx, follower.y + dy, doc);
    return patchMovable(acc, follower.id, { x: centre.x, y: centre.y });
  }, next);
}
