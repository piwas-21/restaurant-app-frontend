import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { updateTable } from './document';

/**
 * Align and distribute for a multi-table selection (FLOOR-PLAN-REVAMP §4.3) —
 * the fastest way to make a plan match a room that was itself laid out on a
 * grid, and the *no-drag* way to arrange tables (SC 2.5.7). Every operation
 * works on the selection's own bounding box, so nothing can travel outside the
 * space the tables already occupy and no plan clamp is needed.
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

const centreOn = (t: FloorPlanTableGeometry, axis: PlanAxis): number => (axis === 'x' ? t.positionX : t.positionY);
const halfOn = (t: FloorPlanTableGeometry, axis: PlanAxis): number => (axis === 'x' ? t.width : t.height) / 2;

const patchFor = (axis: PlanAxis, centre: number): Partial<FloorPlanTableGeometry> =>
  axis === 'x' ? { positionX: centre } : { positionY: centre };

/** The tables named by `ids`, in document order; ids that no longer exist are skipped. */
const selected = (doc: FloorPlanDocument, ids: readonly string[]): FloorPlanTableGeometry[] =>
  doc.tables.filter((t) => ids.includes(t.id));

/**
 * Apply one centre-per-table onto the document, returning the SAME document when
 * nothing actually moves — an already-aligned selection must not cost the user
 * an undo press.
 */
const applyCentres = (doc: FloorPlanDocument, axis: PlanAxis, centres: Map<string, number>): FloorPlanDocument => {
  const moved = [...centres].filter(([id, centre]) => {
    const table = doc.tables.find((t) => t.id === id);
    return table && centreOn(table, axis) !== centre;
  });
  return moved.reduce((next, [id, centre]) => updateTable(next, id, patchFor(axis, centre)), doc);
};

/**
 * Line the selection's chosen edges up. Needs two tables to mean anything;
 * fewer is returned untouched so a caller never has to special-case it.
 */
export function alignTables(doc: FloorPlanDocument, ids: readonly string[], edge: AlignEdge): FloorPlanDocument {
  const tables = selected(doc, ids);
  if (tables.length < 2) {
    return doc;
  }
  const { axis, side } = EDGES[edge];
  const low = Math.min(...tables.map((t) => centreOn(t, axis) - halfOn(t, axis)));
  const high = Math.max(...tables.map((t) => centreOn(t, axis) + halfOn(t, axis)));
  const centres = new Map(
    tables.map((t) => {
      const half = halfOn(t, axis);
      if (side === 0) {
        return [t.id, (low + high) / 2] as const;
      }
      return [t.id, side < 0 ? low + half : high - half] as const;
    }),
  );
  return applyCentres(doc, axis, centres);
}

/**
 * Space the selection evenly *by centre* along one axis, holding the two
 * outermost tables where they are. Needs three tables — with two there is
 * nothing between them to space — so fewer is returned untouched.
 */
export function distributeTables(doc: FloorPlanDocument, ids: readonly string[], axis: PlanAxis): FloorPlanDocument {
  const tables = selected(doc, ids).toSorted((a, b) => centreOn(a, axis) - centreOn(b, axis));
  if (tables.length < 3) {
    return doc;
  }
  const first = centreOn(tables[0], axis);
  // Non-null: the length guard above already rules out an empty list.
  const step = (centreOn(tables.at(-1)!, axis) - first) / (tables.length - 1);
  const centres = new Map(tables.map((t, index) => [t.id, first + step * index] as const));
  return applyCentres(doc, axis, centres);
}
