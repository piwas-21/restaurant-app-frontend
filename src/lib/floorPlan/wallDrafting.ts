import type { FloorPlanDocument, FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { DEFAULT_FLOOR_STYLE } from './floorStyles';
import { nextLocalWallId } from './localIds';
import { snapToGrid } from './snapping';

/**
 * Drawing a wall chain (FLOOR-PLAN-REVAMP §4.3). The tool is **click-to-place
 * vertices** — click, click, click, then Enter / double-click / Esc — so it works
 * identically with a mouse, a finger and a keyboard, and there is no drag
 * anywhere in it (SC 2.5.7). Everything here is pure: the hook contributes only
 * pointer plumbing, and "the wall snaps where the admin expects" is unit-tested.
 *
 * Closing a chain onto its first vertex is what makes a **Room** — there is no
 * second polygon tool, exactly as §4.3 specifies.
 */

/** Which rule moved the raw pointer position — the overlay says so on the canvas. */
export type DraftSnapKind = 'free' | 'grid' | 'endpoint' | 'angle' | 'close';

export interface DraftSnap {
  point: FloorPlanPoint;
  kind: DraftSnapKind;
}

/** A chain part-way through being drawn: the placed corners + the live cursor. */
export interface WallDraftState {
  points: FloorPlanPoint[];
  cursor: DraftSnap | null;
}

/** The default wall thickness in metres (§5.1: `ThicknessMeters` default 0.12). */
export const DEFAULT_WALL_THICKNESS_M = 0.12;

/** A chain shorter than this cannot be a wall — one vertex is a dot, not a run. */
export const MIN_DRAFT_VERTICES = 2;

/** A closed chain needs a real area; two vertices "closed" is a line drawn twice. */
export const MIN_ROOM_VERTICES = 3;

/** Angle snap increments from the previous vertex (§4.3: 0 / 45 / 90°). */
const ANGLE_STEP_DEG = 45;

const distance = (a: FloorPlanPoint, b: FloorPlanPoint): number => Math.hypot(b.x - a.x, b.y - a.y);

/** Every vertex of every wall — the endpoints a new chain can snap onto. */
export const wallVertices = (walls: readonly FloorPlanWall[]): FloorPlanPoint[] => walls.flatMap((wall) => wall.points);

/** The nearest of `candidates` within `toleranceMeters`, or null. */
export function nearestPoint(
  candidates: readonly FloorPlanPoint[],
  to: FloorPlanPoint,
  toleranceMeters: number,
): FloorPlanPoint | null {
  let best: { point: FloorPlanPoint; d: number } | null = null;
  for (const candidate of candidates) {
    const d = distance(candidate, to);
    if (d <= toleranceMeters && (!best || d < best.d)) {
      best = { point: candidate, d };
    }
  }
  return best?.point ?? null;
}

/**
 * Project `to` onto the nearest 45° ray from `from`, quantising the distance
 * along that ray to the grid. Snapping the *length* rather than the resulting
 * x/y is what keeps the angle exact: grid-snapping a 45° point independently on
 * each axis would tilt the segment off 45° for any odd number of grid steps.
 */
export function snapToAngleRay(
  from: FloorPlanPoint,
  to: FloorPlanPoint,
  gridSizeCm: number,
  snapLength: boolean,
): FloorPlanPoint {
  const raw = Math.atan2(to.y - from.y, to.x - from.x);
  const stepRad = (ANGLE_STEP_DEG * Math.PI) / 180;
  const angle = Math.round(raw / stepRad) * stepRad;
  const length = distance(from, to);
  const quantised = snapLength ? snapToGrid(length, gridSizeCm) : length;
  return { x: from.x + Math.cos(angle) * quantised, y: from.y + Math.sin(angle) * quantised };
}

export interface DraftSnapContext {
  /** The vertices placed so far; the last one anchors the angle snap. */
  points: readonly FloorPlanPoint[];
  /** Every existing wall vertex, so chains meet cleanly at shared corners. */
  otherVertices: readonly FloorPlanPoint[];
  gridSizeCm: number;
  /** The toolbar's snap toggle — off means the raw pointer position. */
  snapEnabled: boolean;
  /** Alt suspends snapping for one move, as it does everywhere else (§4.3). */
  suspendSnap: boolean;
  /** Shift frees the angle, so a wall can be drawn at a real-world odd angle. */
  freeAngle: boolean;
  /** Screen-derived tolerance in metres, so snapping feels the same at any zoom. */
  toleranceMeters: number;
}

/**
 * Where the next vertex actually lands. Rules are tried most-intentional first:
 *
 * 1. **Close the loop** — within tolerance of the first vertex, with enough
 *    vertices to enclose an area. This outranks everything: a click there means
 *    "make this a room", and letting a grid snap win would leave a hairline gap.
 * 2. **Another wall's endpoint** — chains that meet must meet *exactly*, or the
 *    room reads as leaky at any zoom.
 * 3. **A 45° ray from the previous vertex** — the overwhelming majority of real
 *    rooms are square, and Shift opts out for the ones that are not.
 * 4. **The grid** — the fallback, and the whole of it for the first vertex.
 */
export function snapDraftPoint(raw: FloorPlanPoint, context: DraftSnapContext): DraftSnap {
  const { points, otherVertices, gridSizeCm, snapEnabled, suspendSnap, freeAngle, toleranceMeters } = context;
  if (!snapEnabled || suspendSnap) {
    return { point: raw, kind: 'free' };
  }

  const first = points[0];
  if (first && points.length >= MIN_ROOM_VERTICES && distance(first, raw) <= toleranceMeters) {
    return { point: first, kind: 'close' };
  }

  const endpoint = nearestPoint(otherVertices, raw, toleranceMeters);
  if (endpoint) {
    return { point: endpoint, kind: 'endpoint' };
  }

  const previous = points[points.length - 1];
  if (previous && !freeAngle) {
    return { point: snapToAngleRay(previous, raw, gridSizeCm, true), kind: 'angle' };
  }

  return { point: { x: snapToGrid(raw.x, gridSizeCm), y: snapToGrid(raw.y, gridSizeCm) }, kind: 'grid' };
}

/** The live length + bearing of the segment being drawn, for the canvas readout. */
export interface DraftReadout {
  lengthMeters: number;
  /** Degrees clockwise from east, normalised to [0, 360). */
  angleDegrees: number;
}

export function draftReadout(from: FloorPlanPoint, to: FloorPlanPoint): DraftReadout {
  const deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return { lengthMeters: distance(from, to), angleDegrees: ((deg % 360) + 360) % 360 };
}

const samePoint = (a: FloorPlanPoint, b: FloorPlanPoint): boolean => a.x === b.x && a.y === b.y;

/**
 * The wall a finished draft becomes, or null when the chain is too short to be
 * one. A closed chain drops a trailing vertex that repeats the first:
 * {@link ./walls}.wallSegments already joins the last point back to the first, so
 * a literal repeat would render a zero-length segment and leave two vertex
 * handles stacked on the same spot. The **closing click produces exactly that
 * repeat** (it snaps onto the first vertex), so this is the normal path, not a
 * defensive one.
 */
export function draftWall(
  doc: FloorPlanDocument,
  points: readonly FloorPlanPoint[],
  isClosed: boolean,
): FloorPlanWall | null {
  const last = points[points.length - 1];
  const repeatsFirst = points.length > 1 && last && samePoint(points[0], last);
  const trimmed = isClosed && repeatsFirst ? points.slice(0, -1) : points;
  const required = isClosed ? MIN_ROOM_VERTICES : MIN_DRAFT_VERTICES;
  if (trimmed.length < required) {
    return null;
  }
  return {
    id: nextLocalWallId(doc),
    points: trimmed.map((p) => ({ x: p.x, y: p.y })),
    thicknessMeters: DEFAULT_WALL_THICKNESS_M,
    isClosed,
    roomName: null,
    floorStyle: isClosed ? DEFAULT_FLOOR_STYLE : null,
    zIndex: doc.walls.length,
    openings: [],
  };
}
