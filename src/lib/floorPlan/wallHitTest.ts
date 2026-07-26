import type { FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { wallSegments, type WallSegment } from './walls';

/**
 * Picking a wall with a pointer (FLOOR-PLAN-REVAMP §4.3). A wall is a polyline,
 * not a footprint, so it cannot go through the {@link ./movable} hit test that
 * tables and items share — a 12 cm-thick run is a couple of screen pixels on a
 * fitted plan and would be unpickable if the test were its literal thickness.
 * The tolerance is therefore a **screen-pixel pad the caller converts through the
 * current zoom**, exactly as the item grab pad is, so a wall stays as easy to hit
 * fitted as zoomed in.
 *
 * Selecting a wall is never the *only* route to editing one: the inspector lists
 * them and the keyboard reaches that list (SC 2.5.7).
 */

/** Perpendicular distance from a point to a segment, clamped to its ends. */
export function distanceToSegment(point: FloorPlanPoint, segment: WallSegment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
  }
  const t = Math.min(
    1,
    Math.max(0, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (segment.start.x + t * dx), point.y - (segment.start.y + t * dy));
}

/** A picked wall, and which of its segments the pointer was nearest. */
export interface WallHit {
  wallId: string;
  segmentIndex: number;
  distance: number;
}

/**
 * The nearest wall within `toleranceMeters` of the point, or null. Walls with no
 * id are skipped: an id is what the selection is expressed in, and every wall the
 * editor can see has one (the server mints them, and a drafted one gets a local
 * id before it enters the document).
 */
export function wallAtPoint(
  walls: readonly FloorPlanWall[],
  point: FloorPlanPoint,
  toleranceMeters: number,
): WallHit | null {
  let best: WallHit | null = null;
  for (const wall of walls) {
    if (!wall.id) {
      continue;
    }
    // Half the wall's own thickness on top of the screen pad — a thick wall is
    // genuinely wider on the plan, and the pointer is inside it.
    const reach = toleranceMeters + wall.thicknessMeters / 2;
    for (const segment of wallSegments(wall)) {
      const distance = distanceToSegment(point, segment);
      if (distance <= reach && (!best || distance < best.distance)) {
        best = { wallId: wall.id, segmentIndex: segment.index, distance };
      }
    }
  }
  return best;
}

/** The wall with this id, or null. */
export const findWall = (walls: readonly FloorPlanWall[], id: string | null): FloorPlanWall | null =>
  (id && walls.find((wall) => wall.id === id)) || null;
