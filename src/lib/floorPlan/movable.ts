import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';
import type { OrientedRect } from './geometry';
import { isSymbolItemKind } from './symbols';

/**
 * One geometry vocabulary for everything the editor can move (FLOOR-PLAN-REVAMP
 * §4.3). Tables and items are stored under different field names — a table has
 * `positionX/width/rotation`, an item has `x/widthMeters/rotationDegrees` — but a
 * drag, a nudge, a grip and the inspector all do the *same* thing to both. So
 * every one of those paths is written once against a {@link Movable}, and this
 * module is the only place that knows which collection an id came from.
 *
 * `Movable` is deliberately an {@link OrientedRect} plus an identity: the snap,
 * overlap and handle maths already speak that shape, so nothing has to convert.
 */

/** Which collection a movable id lives in — they differ in what *else* they carry. */
export type MovableTarget = 'table' | 'item';

/** The geometry a gesture / nudge / inspector edit can change, in one naming. */
export type MovableGeometry = OrientedRect;

export interface Movable extends MovableGeometry {
  id: string;
  target: MovableTarget;
}

export const tableMovable = (t: FloorPlanTableGeometry): Movable => ({
  id: t.id,
  target: 'table',
  x: t.positionX,
  y: t.positionY,
  widthMeters: t.width,
  heightMeters: t.height,
  rotationDegrees: t.rotation,
});

/**
 * An item as a movable. Items carry the normalised names already; only the id is
 * optional in the DTO, so an item that has none (never true for a stored plan or
 * for one the editor placed) is not movable and is skipped rather than faked.
 *
 * A **zone region, text label or entrance marker is not movable either** — each
 * needs an affordance for the thing it actually carries, which lands with S8
 * ({@link isSymbolItemKind}). Returning null here is what keeps them out of the
 * hit test, the marquee, the keyboard and the inspector in one move.
 */
export const itemMovable = (i: FloorPlanItem): Movable | null =>
  i.id && isSymbolItemKind(i.kind)
    ? {
        id: i.id,
        target: 'item',
        x: i.x,
        y: i.y,
        widthMeters: i.widthMeters,
        heightMeters: i.heightMeters,
        rotationDegrees: i.rotationDegrees,
      }
    : null;

/** Everything the editor can move, tables first — the order selections are read in. */
export const documentMovables = (doc: FloorPlanDocument): Movable[] => [
  ...doc.tables.map(tableMovable),
  ...doc.items.map(itemMovable).filter((m): m is Movable => m !== null),
];

/** The movable with this id, whichever collection holds it. */
export const findMovable = (doc: FloorPlanDocument, id: string): Movable | null =>
  documentMovables(doc).find((m) => m.id === id) ?? null;

/** Every movable named by `ids`, in document order; unknown ids are skipped. */
export const selectedMovables = (doc: FloorPlanDocument, ids: readonly string[]): Movable[] =>
  documentMovables(doc).filter((m) => ids.includes(m.id));

/** The alignment/snap targets while dragging one movable: every *other* footprint. */
export const otherMovableRects = (doc: FloorPlanDocument, excludeId: string): MovableGeometry[] =>
  documentMovables(doc).filter((m) => m.id !== excludeId);

const GEOMETRY_KEYS = ['x', 'y', 'widthMeters', 'heightMeters', 'rotationDegrees'] as const;

/** Freeze the editable geometry, to compare a gesture's end against its start. */
export const geometrySnapshot = (m: MovableGeometry): MovableGeometry => ({
  x: m.x,
  y: m.y,
  widthMeters: m.widthMeters,
  heightMeters: m.heightMeters,
  rotationDegrees: m.rotationDegrees,
});

/** Did a gesture actually change anything? Drives the "skip the no-op" history rule. */
export const sameGeometry = (a: MovableGeometry, b: MovableGeometry): boolean =>
  GEOMETRY_KEYS.every((key) => a[key] === b[key]);

/**
 * Translate a normalised patch into a table's field names. An item needs no
 * translation — its own DTO already uses these names, which is why the normalised
 * vocabulary is the item's rather than the table's.
 */
export function tableGeometryPatch(patch: Partial<MovableGeometry>): Partial<FloorPlanTableGeometry> {
  const out: Partial<FloorPlanTableGeometry> = {};
  if (patch.x !== undefined) {
    out.positionX = patch.x;
  }
  if (patch.y !== undefined) {
    out.positionY = patch.y;
  }
  if (patch.widthMeters !== undefined) {
    out.width = patch.widthMeters;
  }
  if (patch.heightMeters !== undefined) {
    out.height = patch.heightMeters;
  }
  if (patch.rotationDegrees !== undefined) {
    out.rotation = patch.rotationDegrees;
  }
  return out;
}
