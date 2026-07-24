import type { FloorPlanPoint } from '@/types/floorPlan';
import type { OrientedRect } from './geometry';

/**
 * On-canvas handle geometry for the admin editor (FLOOR-PLAN-REVAMP §4.3/§4.4).
 * Everything here works in the rect's OWN frame and then rotates back out to the
 * plan, so a rotated table resizes along its own length and width rather than
 * the screen's axes, and the grip you grabbed is the one that follows the
 * pointer. Pure and unit-tested; the rendering layer only converts the returned
 * metres to centimetres and holds the grips at a constant screen size.
 */

/** `data-handle` token for the rotate grip; resize grips use their own ids. */
export const ROTATE_HANDLE = 'rotate';

/** The eight resize grips, named for the direction they pull. */
export type ResizeHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** A grip's pull direction in the rect's unrotated frame (−1, 0 or +1 per axis). */
export interface HandleAnchor {
  id: ResizeHandleId;
  sx: -1 | 0 | 1;
  sy: -1 | 0 | 1;
}

export const RESIZE_HANDLES: readonly HandleAnchor[] = [
  { id: 'nw', sx: -1, sy: -1 },
  { id: 'n', sx: 0, sy: -1 },
  { id: 'ne', sx: 1, sy: -1 },
  { id: 'e', sx: 1, sy: 0 },
  { id: 'se', sx: 1, sy: 1 },
  { id: 's', sx: 0, sy: 1 },
  { id: 'sw', sx: -1, sy: 1 },
  { id: 'w', sx: -1, sy: 0 },
];

const HANDLE_BY_ID = new Map<string, HandleAnchor>(RESIZE_HANDLES.map((h) => [h.id, h]));

/** Look a grip up by its `data-handle` value; null when the token is not a grip. */
export const resizeHandle = (id: string | undefined): HandleAnchor | null =>
  (id ? HANDLE_BY_ID.get(id) : undefined) ?? null;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Rotate a local-frame offset (metres) out to a plan point. */
function fromLocal(rect: OrientedRect, lx: number, ly: number): FloorPlanPoint {
  const a = toRadians(rect.rotationDegrees);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: rect.x + lx * cos - ly * sin, y: rect.y + lx * sin + ly * cos };
}

/** Project a plan point into the rect's local frame (centre origin, unrotated). */
function toLocal(rect: OrientedRect, point: FloorPlanPoint): FloorPlanPoint {
  const a = toRadians(rect.rotationDegrees);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = point.x - rect.x;
  const dy = point.y - rect.y;
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** Where a resize grip sits on the plan (metres). */
export const handlePoint = (rect: OrientedRect, anchor: HandleAnchor): FloorPlanPoint =>
  fromLocal(rect, (anchor.sx * rect.widthMeters) / 2, (anchor.sy * rect.heightMeters) / 2);

/** Where the rotate grip sits: `armMeters` beyond the middle of the top edge. */
export const rotateHandlePoint = (rect: OrientedRect, armMeters: number): FloorPlanPoint =>
  fromLocal(rect, 0, -rect.heightMeters / 2 - armMeters);

/**
 * The rotation (degrees, normalised to [0, 360)) that aims the rotate grip at
 * `point`. 0° is straight up, matching the grip's resting place above the rect,
 * so the shape tracks the pointer instead of jumping by a quarter turn.
 */
export function angleFromPointer(centre: FloorPlanPoint, point: FloorPlanPoint): number {
  const degrees = (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI + 90;
  return ((degrees % 360) + 360) % 360;
}

export interface ResizeResult {
  x: number;
  y: number;
  widthMeters: number;
  heightMeters: number;
}

export interface ResizeOptions {
  /** Floor for either extent, so a grip can never collapse or invert a rect. */
  minSizeMeters: number;
  /** Ceilings per axis — the server clamps size to the plan, so the canvas must too. */
  maxWidthMeters?: number;
  maxHeightMeters?: number;
  /** Grid step to round the new extent to; omit to resize freely. */
  snapStepMeters?: number;
}

interface AxisOptions {
  minSizeMeters: number;
  maxSizeMeters?: number;
  snapStepMeters?: number;
}

/** The new extent and local centre on one axis, keeping the opposite edge pinned. */
function resizeAxis(sign: -1 | 0 | 1, sizeMeters: number, local: number, options: AxisOptions) {
  if (sign === 0) {
    return { size: sizeMeters, centre: 0 };
  }
  const pinned = (-sign * sizeMeters) / 2;
  // Measured from the pinned edge towards the grip, so dragging a grip past its
  // opposite edge stops at the minimum instead of flipping the rect inside out.
  const reach = (local - pinned) * sign;
  const stepped = options.snapStepMeters ? Math.round(reach / options.snapStepMeters) * options.snapStepMeters : reach;
  // Bound BEFORE the centre is derived, so the pinned edge stays pinned at the
  // limit instead of drifting as it would if the size were clamped afterwards.
  const size = Math.min(Math.max(stepped, options.minSizeMeters), options.maxSizeMeters ?? Infinity);
  return { size, centre: pinned + (sign * size) / 2 };
}

/**
 * Resize an oriented rect by dragging one grip to `point`. The opposite edge (or
 * corner) stays put in plan space and the extents are measured along the rect's
 * own axes; edge grips change one axis only. Returns the new centre and size —
 * the caller still clamps the centre into the plan, exactly like a move.
 */
export function resizeRect(
  rect: OrientedRect,
  anchor: HandleAnchor,
  point: FloorPlanPoint,
  options: ResizeOptions,
): ResizeResult {
  const local = toLocal(rect, point);
  const x = resizeAxis(anchor.sx, rect.widthMeters, local.x, { ...options, maxSizeMeters: options.maxWidthMeters });
  const y = resizeAxis(anchor.sy, rect.heightMeters, local.y, { ...options, maxSizeMeters: options.maxHeightMeters });
  const centre = fromLocal(rect, x.centre, y.centre);
  return { x: centre.x, y: centre.y, widthMeters: x.size, heightMeters: y.size };
}
