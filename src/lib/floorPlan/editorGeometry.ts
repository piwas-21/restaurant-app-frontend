import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { obbOverlap, type OrientedRect } from './geometry';
import type { SnapRect } from './snapping';

/**
 * Table-geometry helpers for the admin editor (FLOOR-PLAN-REVAMP §4.3). A table's
 * `positionX/Y` is its centre and rotation is about that centre (§4.1), so the
 * snap/overlap maths reads it straight through. Pure and unit-tested; the editor
 * hook stays a thin event layer over `snapping` + these derivations.
 */

/** A table's footprint as an axis-aligned snap rect (centre + size, metres). */
export const tableSnapRect = (t: FloorPlanTableGeometry): SnapRect => ({
  x: t.positionX,
  y: t.positionY,
  widthMeters: t.width,
  heightMeters: t.height,
});

/** A table's footprint as an oriented rect (adds rotation) for the overlap test. */
export const tableOrientedRect = (t: FloorPlanTableGeometry): OrientedRect => ({
  x: t.positionX,
  y: t.positionY,
  widthMeters: t.width,
  heightMeters: t.height,
  rotationDegrees: t.rotation,
});

/** Snap rects for every table except `excludeId` — the alignment targets while dragging one. */
export const otherTableRects = (tables: readonly FloorPlanTableGeometry[], excludeId: string): SnapRect[] =>
  tables.filter((t) => t.id !== excludeId).map(tableSnapRect);

/**
 * Ids of every table whose oriented footprint overlaps another's — the editor
 * outlines these and shows a counter (warned, never blocked; §4.3). O(n²) over
 * the table count, which a single room never makes large.
 */
export function overlappingTableIds(tables: readonly FloorPlanTableGeometry[]): Set<string> {
  const rects = tables.map((t) => ({ id: t.id, rect: tableOrientedRect(t) }));
  const hits = new Set<string>();
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (obbOverlap(rects[i].rect, rects[j].rect)) {
        hits.add(rects[i].id);
        hits.add(rects[j].id);
      }
    }
  }
  return hits;
}

/**
 * Clamp a table centre so it stays inside the plan — mirrors the server clamp
 * (`PositionX ∈ [0, width]`), so a drag can never place a table where Save would
 * silently move it.
 */
export const clampCentreToPlan = (
  x: number,
  y: number,
  plan: Pick<FloorPlanDocument, 'widthMeters' | 'heightMeters'>,
): { x: number; y: number } => ({
  x: Math.min(Math.max(x, 0), plan.widthMeters),
  y: Math.min(Math.max(y, 0), plan.heightMeters),
});
