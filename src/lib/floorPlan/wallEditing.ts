import type { FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { MIN_DRAFT_VERTICES, MIN_ROOM_VERTICES } from './wallDrafting';
import { wallSegments, type WallSegment } from './walls';

/**
 * Reshaping a wall after it has been drawn (FLOOR-PLAN-REVAMP §4.3) — move a
 * corner, insert one on a side, remove one. Pure, so the rule that actually
 * matters here is testable: **openings are pinned to a segment by index**, and
 * every one of these operations renumbers the segments underneath them. Getting
 * that wrong doesn't throw — it silently slides a door onto a different wall.
 */

/** `SaveFloorPlanCommandValidator` rejects a wall with more than this many vertices. */
export const MAX_WALL_VERTICES = 200;

/** The fewest vertices this wall can be left with and still be what it claims. */
const minVertices = (wall: FloorPlanWall): number => (wall.isClosed ? MIN_ROOM_VERTICES : MIN_DRAFT_VERTICES);

/** How far along a segment a point projects, in metres, clamped to its ends. */
export function distanceAlong(segment: WallSegment, point: FloorPlanPoint): number {
  if (segment.length === 0) {
    return 0;
  }
  const ux = Math.cos(segment.angleRad);
  const uy = Math.sin(segment.angleRad);
  const along = (point.x - segment.start.x) * ux + (point.y - segment.start.y) * uy;
  return Math.min(Math.max(along, 0), segment.length);
}

/** Move one corner. Openings are untouched — the segments keep their numbering. */
export function moveWallVertex(wall: FloorPlanWall, index: number, point: FloorPlanPoint): FloorPlanWall {
  if (index < 0 || index >= wall.points.length) {
    return wall;
  }
  return {
    ...wall,
    points: wall.points.map((p, i) => (i === index ? { x: point.x, y: point.y } : p)),
  };
}

/**
 * Insert a corner part-way along a side, splitting it in two.
 *
 * Openings after the split move up an index; openings on the split side go to
 * whichever half now contains them, with their offset re-measured from that
 * half's start. **One that straddles the new corner is dropped**: a door is a
 * straight span on one segment, so there is no honest way to bend it round a
 * corner, and silently shrinking it would move a doorway the admin never touched.
 */
export function insertWallVertex(wall: FloorPlanWall, segmentIndex: number, point: FloorPlanPoint): FloorPlanWall {
  const segment = wallSegments(wall)[segmentIndex];
  if (!segment || wall.points.length >= MAX_WALL_VERTICES) {
    return wall;
  }
  const at = distanceAlong(segment, point);
  const points = [
    ...wall.points.slice(0, segmentIndex + 1),
    { x: point.x, y: point.y },
    ...wall.points.slice(segmentIndex + 1),
  ];
  const openings = wall.openings.flatMap((opening) => {
    if (opening.segmentIndex < segmentIndex) {
      return [opening];
    }
    if (opening.segmentIndex > segmentIndex) {
      return [{ ...opening, segmentIndex: opening.segmentIndex + 1 }];
    }
    if (opening.offsetMeters + opening.widthMeters <= at) {
      return [opening];
    }
    if (opening.offsetMeters >= at) {
      return [{ ...opening, segmentIndex: segmentIndex + 1, offsetMeters: opening.offsetMeters - at }];
    }
    return [];
  });
  return { ...wall, points, openings };
}

/**
 * Remove a corner, merging the two sides that met at it into one.
 *
 * **Openings on either of those two sides are dropped.** They were measured
 * along geometry that no longer exists, so keeping them would leave a door at an
 * offset that means something different — worse than losing it, because nobody
 * would notice. Refuses the removal outright if it would leave the wall too short
 * to be a run (or a room).
 */
export function removeWallVertex(wall: FloorPlanWall, index: number): FloorPlanWall {
  const count = wall.points.length;
  if (index < 0 || index >= count || count - 1 < minVertices(wall)) {
    return wall;
  }
  // The side *before* this corner is `index - 1`; on a closed chain corner 0's
  // predecessor is the closing side, which wraps to the last one.
  const previous = wall.isClosed ? (index - 1 + count) % count : index - 1;
  const dropped = new Set([index, previous]);
  const openings = wall.openings
    .filter((opening) => !dropped.has(opening.segmentIndex))
    .map((opening) =>
      opening.segmentIndex > index ? { ...opening, segmentIndex: opening.segmentIndex - 1 } : opening,
    );
  return { ...wall, points: wall.points.filter((_, i) => i !== index), openings };
}

/** A side's midpoint — the dot you click to insert a corner there. */
export interface SegmentMidpoint {
  segmentIndex: number;
  point: FloorPlanPoint;
  lengthMeters: number;
}

/** Every side's midpoint, in segment order. Zero-length sides are skipped. */
export const segmentMidpoints = (wall: FloorPlanWall): SegmentMidpoint[] =>
  wallSegments(wall)
    .filter((segment) => segment.length > 0)
    .map((segment) => ({
      segmentIndex: segment.index,
      point: { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 },
      lengthMeters: segment.length,
    }));

/** Can this corner be removed, or is the wall already at its floor? */
export const canRemoveVertex = (wall: FloorPlanWall): boolean => wall.points.length - 1 >= minVertices(wall);
