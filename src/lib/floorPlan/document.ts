import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';

/**
 * Immutable editor operations on a floor-plan document (FLOOR-PLAN-REVAMP §4.3,
 * §5.3). Every op returns a NEW document, sharing untouched arrays, so the
 * undo/redo stack ({@link ./history}) can hold whole snapshots cheaply and a
 * prior state is never mutated. Callers assign ids for created items (the editor
 * mints a client id until Save persists the server id). Pure and unit-tested.
 */

/** Patch a table's geometry by id, leaving others untouched. */
export function updateTable(
  doc: FloorPlanDocument,
  id: string,
  patch: Partial<FloorPlanTableGeometry>,
): FloorPlanDocument {
  return { ...doc, tables: doc.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

/** Patch an item by id. */
export function updateItem(doc: FloorPlanDocument, id: string, patch: Partial<FloorPlanItem>): FloorPlanDocument {
  return { ...doc, items: doc.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function addItem(doc: FloorPlanDocument, item: FloorPlanItem): FloorPlanDocument {
  return { ...doc, items: [...doc.items, item] };
}

export function removeItem(doc: FloorPlanDocument, id: string): FloorPlanDocument {
  return { ...doc, items: doc.items.filter((i) => i.id !== id) };
}

/** Patch a wall by id. */
export function updateWall(doc: FloorPlanDocument, id: string, patch: Partial<FloorPlanWall>): FloorPlanDocument {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) };
}

export function addWall(doc: FloorPlanDocument, wall: FloorPlanWall): FloorPlanDocument {
  return { ...doc, walls: [...doc.walls, wall] };
}

export function removeWall(doc: FloorPlanDocument, id: string): FloorPlanDocument {
  return { ...doc, walls: doc.walls.filter((w) => w.id !== id) };
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
