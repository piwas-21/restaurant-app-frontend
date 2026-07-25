import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';
import { resizeHandle, type HandleAnchor } from '../handles';

/**
 * Shared builders for the editor's unit tests (FLOOR-PLAN-REVAMP §4.3). One
 * source for the table/item/document literals so the geometry, gesture, drag and
 * handle suites can't drift apart — and so the same twelve-field DTO shape isn't
 * repeated in four files.
 */

/** A 1 m × 1 m table at (1, 1), unrotated. Override whatever the test is about. */
export const tableGeometry = (over: Partial<FloorPlanTableGeometry> = {}): FloorPlanTableGeometry => ({
  id: 'a',
  tableNumber: '1',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  notes: null,
  positionX: 1,
  positionY: 1,
  width: 1,
  height: 1,
  shape: 'square',
  rotation: 0,
  ...over,
});

/** A 1 m × 1 m placed item at (3, 3) — a column, whose symbol is a square. */
export const planItem = (over: Partial<FloorPlanItem> = {}): FloorPlanItem => ({
  id: 'i1',
  kind: 'column',
  x: 3,
  y: 3,
  widthMeters: 1,
  heightMeters: 1,
  rotationDegrees: 0,
  zIndex: 1,
  label: null,
  styleVariant: null,
  ...over,
});

/** A bare 10 m × 8 m plan on a 25 cm grid, holding the given tables. */
export const planDocument = (
  tables: FloorPlanTableGeometry[],
  over: Partial<FloorPlanDocument> = {},
): FloorPlanDocument => ({
  id: 'plan',
  name: 'Plan',
  widthMeters: 10,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: 'plain',
  isDefault: true,
  displayOrder: 0,
  updatedAt: null,
  walls: [],
  items: [],
  tables,
  ...over,
});

/** A resize grip by id, failing the test loudly rather than returning null. */
export const anchorOf = (id: string): HandleAnchor => {
  const found = resizeHandle(id);
  if (!found) {
    throw new Error(`no such handle: ${id}`);
  }
  return found;
};
