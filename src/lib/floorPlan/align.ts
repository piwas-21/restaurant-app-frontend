import type { FloorPlanDocument } from '@/types/floorPlan';
import { patchMovable } from './document';
import { selectedMovables, type Movable } from './movable';

/**
 * Align and distribute for a multi-object selection (FLOOR-PLAN-REVAMP §4.3) —
 * the fastest way to make a plan match a room that was itself laid out on a
 * grid, and the *no-drag* way to arrange things (SC 2.5.7). Tables and placed
 * items line up together: a row of stools along a bar is the same operation as a
 * row of tables, so both are one code path over {@link Movable}. Every operation
 * works on the selection's own bounding box, so nothing can travel outside the
 * space the objects already occupy and no plan clamp is needed.
 */

export type PlanAxis = 'x' | 'y';
export type AlignEdge = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';

/** Which side of the bounding box an edge aligns to: low, centre, or high. */
type EdgeSide = -1 | 0 | 1;

const EDGES: Record<AlignEdge, { axis: PlanAxis; side: EdgeSide }> = {
  left: { axis: 'x', side: -1 },
  centerX: { axis: 'x', side: 0 },
  right: { axis: 'x', side: 1 },
  top: { axis: 'y', side: -1 },
  middleY: { axis: 'y', side: 0 },
  bottom: { axis: 'y', side: 1 },
};

const centreOn = (m: Movable, axis: PlanAxis): number => (axis === 'x' ? m.x : m.y);
const halfOn = (m: Movable, axis: PlanAxis): number => (axis === 'x' ? m.widthMeters : m.heightMeters) / 2;

const patchFor = (axis: PlanAxis, centre: number) => (axis === 'x' ? { x: centre } : { y: centre });

/** Where one object is going. Carrying the movable itself keeps the lookup honest. */
interface Placement {
  movable: Movable;
  centre: number;
}

/**
 * Apply one centre-per-object onto the document, returning the SAME document when
 * nothing actually moves — an already-aligned selection must not cost the user
 * an undo press.
 */
const applyCentres = (doc: FloorPlanDocument, axis: PlanAxis, targets: Placement[]): FloorPlanDocument =>
  targets
    .filter(({ movable, centre }) => centreOn(movable, axis) !== centre)
    .reduce((next, { movable, centre }) => patchMovable(next, movable.id, patchFor(axis, centre)), doc);

/**
 * Line the selection's chosen edges up. Needs two objects to mean anything;
 * fewer is returned untouched so a caller never has to special-case it.
 */
export function alignMovables(doc: FloorPlanDocument, ids: readonly string[], edge: AlignEdge): FloorPlanDocument {
  const picked = selectedMovables(doc, ids);
  if (picked.length < 2) {
    return doc;
  }
  const { axis, side } = EDGES[edge];
  const low = Math.min(...picked.map((m) => centreOn(m, axis) - halfOn(m, axis)));
  const high = Math.max(...picked.map((m) => centreOn(m, axis) + halfOn(m, axis)));
  const targets = picked.map((movable) => {
    const half = halfOn(movable, axis);
    if (side === 0) {
      return { movable, centre: (low + high) / 2 };
    }
    return { movable, centre: side < 0 ? low + half : high - half };
  });
  return applyCentres(doc, axis, targets);
}

/**
 * Space the selection evenly *by centre* along one axis, holding the two
 * outermost objects where they are. Needs three — with two there is nothing
 * between them to space — so fewer is returned untouched.
 */
export function distributeMovables(doc: FloorPlanDocument, ids: readonly string[], axis: PlanAxis): FloorPlanDocument {
  const picked = selectedMovables(doc, ids).toSorted((a, b) => centreOn(a, axis) - centreOn(b, axis));
  if (picked.length < 3) {
    return doc;
  }
  const first = centreOn(picked[0], axis);
  // Non-null: the length guard above already rules out an empty list.
  const step = (centreOn(picked.at(-1)!, axis) - first) / (picked.length - 1);
  return applyCentres(
    doc,
    axis,
    picked.map((movable, index) => ({ movable, centre: first + step * index })),
  );
}
