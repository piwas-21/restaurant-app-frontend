import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';

/**
 * Immutable editor operations on a floor-plan document (FLOOR-PLAN-REVAMP §4.3,
 * §5.3). Every op returns a NEW document, sharing untouched arrays, so the
 * undo/redo stack ({@link ./history}) can hold whole snapshots cheaply and a
 * prior state is never mutated. Callers assign ids for created items (the editor
 * mints a client id until Save persists the server id). Pure and unit-tested.
 */

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
 * Find any movable object by id (table or item) — the editor's selection is a
 * single id across both collections. Returns null when nothing matches.
 */
export function findMovable(
  doc: FloorPlanDocument,
  id: string,
): { kind: 'table'; table: FloorPlanTableGeometry } | { kind: 'item'; item: FloorPlanItem } | null {
  const table = doc.tables.find((t) => t.id === id);
  if (table) {
    return { kind: 'table', table };
  }
  const item = doc.items.find((i) => i.id === id);
  if (item) {
    return { kind: 'item', item };
  }
  return null;
}
