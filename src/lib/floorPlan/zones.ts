import type { FloorPlanDocument, FloorPlanPoint, FloorPlanTableGeometry } from '@/types/floorPlan';
import { pointInRect } from './geometry';

/**
 * Zone derivation for the guest map (FLOOR-PLAN-REVAMP §4.2). A table has no
 * explicit "zone" field — its zone is **where it stands**, resolved against the
 * drawn plan rather than a separate, driftable field, which is what keeps the
 * chips ("Main room", "Terrace") true to what the guest is looking at.
 *
 * Two things can name a place, and they are tried most-specific first:
 *
 * 1. a **zone region** (S8) — a soft named area an admin drew *because* it does
 *    not have walls of its own: a lounge corner, a window row, the terrace end of
 *    a single room. One inside a room has to win, or drawing it would do nothing;
 * 2. the **named room** the table's walls enclose.
 *
 * Pure and metre-space.
 */

/** Ray-casting point-in-polygon (metres). Boundary points are treated inclusively-enough for zones. */
export function pointInPolygon(point: FloorPlanPoint, polygon: FloorPlanPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const straddles = pi.y > point.y !== pj.y > point.y;
    if (straddles && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** The zone a point falls in — a drawn region first, else the room around it. */
export function zoneAt(point: FloorPlanPoint, plan: Pick<FloorPlanDocument, 'walls' | 'items'>): string | null {
  for (const item of plan.items) {
    // An unnamed region is decoration, so it names nothing. A zone is an oriented
    // rectangle like any other item, so a rotated one tests correctly rather than
    // against its axis-aligned bounds.
    if (item.kind === 'zone' && item.label && pointInRect(item, point)) {
      return item.label;
    }
  }
  for (const wall of plan.walls) {
    if (wall.isClosed && wall.roomName && wall.points.length >= 3 && pointInPolygon(point, wall.points)) {
      return wall.roomName;
    }
  }
  return null;
}

/** The name of the zone a table sits in, or null when it is in no named zone. */
export const tableZone = (
  table: FloorPlanTableGeometry,
  plan: Pick<FloorPlanDocument, 'walls' | 'items'>,
): string | null => zoneAt({ x: table.positionX, y: table.positionY }, plan);

/** The distinct zones present among the tables, in first-seen order. */
export function planZones(
  tables: readonly FloorPlanTableGeometry[],
  plan: Pick<FloorPlanDocument, 'walls' | 'items'>,
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const table of tables) {
    const zone = tableZone(table, plan);
    if (zone && !seen.has(zone)) {
      seen.add(zone);
      order.push(zone);
    }
  }
  return order;
}
