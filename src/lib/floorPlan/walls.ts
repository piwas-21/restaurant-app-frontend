import type { FloorPlanOpening, FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';

/**
 * Wall / room geometry (FLOOR-PLAN-REVAMP §4.3, §5.3). A wall is an ordered
 * polyline of vertices in metres; a closed chain encloses a room. Openings are
 * pinned to a segment by index + offset, so this module resolves segments and
 * their placements once for both the renderer and (later) the editor. All maths
 * is in metres — the scene converts to centimetres at the viewBox boundary.
 */

/** One segment of a wall polyline, in metres. */
export interface WallSegment {
  index: number;
  start: FloorPlanPoint;
  end: FloorPlanPoint;
  length: number;
  angleRad: number;
}

/** An opening resolved to its two endpoints on its wall segment, in metres. */
export interface OpeningSpan {
  start: FloorPlanPoint;
  end: FloorPlanPoint;
  angleRad: number;
  segment: WallSegment;
}

const distance = (a: FloorPlanPoint, b: FloorPlanPoint): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * The segments of a wall. A closed chain of n vertices has n segments (the last
 * joins the final vertex back to the first); an open run has n − 1.
 */
export function wallSegments(wall: FloorPlanWall): WallSegment[] {
  const { points } = wall;
  if (points.length < 2) {
    return [];
  }

  const lastIndex = wall.isClosed && points.length > 2 ? points.length : points.length - 1;
  const segments: WallSegment[] = [];
  for (let i = 0; i < lastIndex; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    segments.push({
      index: i,
      start,
      end,
      length: distance(start, end),
      angleRad: Math.atan2(end.y - start.y, end.x - start.x),
    });
  }
  return segments;
}

/**
 * Resolve an opening to its endpoints on its wall segment. The opening is placed
 * `offsetMeters` from the segment start and is `widthMeters` long, clamped so it
 * never runs past the segment's end. Returns null when the opening references a
 * segment the wall doesn't have.
 */
export function openingSpan(wall: FloorPlanWall, opening: FloorPlanOpening): OpeningSpan | null {
  const segments = wallSegments(wall);
  const segment = segments[opening.segmentIndex];
  if (!segment || segment.length === 0) {
    return null;
  }

  const width = Math.min(Math.max(opening.widthMeters, 0), segment.length);
  const offset = Math.min(Math.max(opening.offsetMeters, 0), segment.length - width);
  const ux = Math.cos(segment.angleRad);
  const uy = Math.sin(segment.angleRad);

  return {
    start: { x: segment.start.x + ux * offset, y: segment.start.y + uy * offset },
    end: { x: segment.start.x + ux * (offset + width), y: segment.start.y + uy * (offset + width) },
    angleRad: segment.angleRad,
    segment,
  };
}

/** The polygon of a closed wall (its floor outline); empty for an open run. */
export function roomPolygonPoints(wall: FloorPlanWall): FloorPlanPoint[] {
  return wall.isClosed && wall.points.length >= 3 ? wall.points : [];
}

/** Signed-area magnitude of a closed polygon, in square metres (shoelace). */
export function polygonAreaM2(points: FloorPlanPoint[]): number {
  if (points.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Anchor point for a room's name — inset from the room's top-left corner, not
 * its centre where tables sit on it (FLOOR-PLAN-REVAMP §4.4). Returns null for a
 * wall with no room polygon.
 */
export function roomLabelAnchor(wall: FloorPlanWall, insetMeters = 0.35): FloorPlanPoint | null {
  const polygon = roomPolygonPoints(wall);
  if (polygon.length === 0) {
    return null;
  }
  const minX = Math.min(...polygon.map((p) => p.x));
  const minY = Math.min(...polygon.map((p) => p.y));
  return { x: minX + insetMeters, y: minY + insetMeters };
}
