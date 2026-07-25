import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { obbOverlap } from './geometry';
import { tableMovable } from './movable';

/**
 * Plan-level geometry rules for the admin editor (FLOOR-PLAN-REVAMP §4.3): what
 * counts as an overlap, and where the plan's edges are. The per-object footprint
 * maths lives in {@link ./movable}, which speaks one vocabulary for tables and
 * items alike. Pure and unit-tested; the editor hooks stay thin event layers.
 */

/**
 * Ids of every table whose oriented footprint overlaps another's — the editor
 * outlines these and shows a counter (warned, never blocked; §4.3). **Tables
 * only:** a table standing on a rug or in front of a bar is how a room actually
 * looks, so counting decor would turn the warning into noise. O(n²) over the
 * table count, which a single room never makes large.
 */
export function overlappingTableIds(tables: readonly FloorPlanTableGeometry[]): Set<string> {
  const rects = tables.map(tableMovable);
  const hits = new Set<string>();
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (obbOverlap(rects[i], rects[j])) {
        hits.add(rects[i].id);
        hits.add(rects[j].id);
      }
    }
  }
  return hits;
}

/**
 * Clamp a centre so the object stays inside the plan — mirrors the server clamp
 * (`X ∈ [0, width]` for both tables and items), so an edit can never place
 * something where Save would silently move it.
 */
export const clampCentreToPlan = (
  x: number,
  y: number,
  plan: Pick<FloorPlanDocument, 'widthMeters' | 'heightMeters'>,
): { x: number; y: number } => ({
  x: Math.min(Math.max(x, 0), plan.widthMeters),
  y: Math.min(Math.max(y, 0), plan.heightMeters),
});
