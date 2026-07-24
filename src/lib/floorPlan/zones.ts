import type { FloorPlanPoint, FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';

/**
 * Zone derivation for the guest map (FLOOR-PLAN-REVAMP §4.2). A table has no
 * explicit "zone" field — its zone is the named room it sits in. This resolves
 * the room by point-in-polygon against the closed walls, which keeps the zone
 * chips ("Main room", "Terrace") true to the drawn plan instead of a separate,
 * driftable field. Pure and metre-space.
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

/** The name of the room a table sits in, or null when it is in no named room. */
export function tableRoom(table: FloorPlanTableGeometry, walls: FloorPlanWall[]): string | null {
  const point = { x: table.positionX, y: table.positionY };
  for (const wall of walls) {
    if (wall.isClosed && wall.roomName && wall.points.length >= 3 && pointInPolygon(point, wall.points)) {
      return wall.roomName;
    }
  }
  return null;
}

/** The distinct room zones present among the tables, in first-seen order. */
export function planZones(tables: FloorPlanTableGeometry[], walls: FloorPlanWall[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const table of tables) {
    const room = tableRoom(table, walls);
    if (room && !seen.has(room)) {
      seen.add(room);
      order.push(room);
    }
  }
  return order;
}
