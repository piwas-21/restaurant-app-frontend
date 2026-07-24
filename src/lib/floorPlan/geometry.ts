import type { FloorPlanPoint } from '@/types/floorPlan';

/**
 * Coordinate helpers for the floor-plan scene (FLOOR-PLAN-REVAMP §4.1). Storage
 * is metres; the SVG renders in centimetres as its user unit (a 12 m × 8 m room
 * is `viewBox="0 0 1200 800"`) so strokes and text scale predictably with no
 * sub-unit rounding fuzz. This module is the one place unit conversion, the
 * viewBox, screen↔plan projection and oriented-box overlap live.
 */
export const METRES_TO_CM = 100;

export const metresToCm = (metres: number): number => metres * METRES_TO_CM;
export const cmToMetres = (cm: number): number => cm / METRES_TO_CM;

/** An SVG viewBox in centimetre user units. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle centred on (x, y) in metres, rotated about its centre. */
export interface OrientedRect {
  x: number;
  y: number;
  widthMeters: number;
  heightMeters: number;
  rotationDegrees: number;
}

/** The minimal DOM rect shape screen→plan projection needs (SSR-safe). */
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The viewBox for a room of the given metre dimensions, with a uniform padding
 * ring (default 20 cm) so edge walls and their strokes are never clipped. The
 * plan scales to fit its container via `preserveAspectRatio="xMidYMid meet"`, so
 * it can never be squashed or letterboxed by a breakpoint.
 */
export function computeViewBox(widthMeters: number, heightMeters: number, paddingCm = 20): ViewBox {
  return {
    x: -paddingCm,
    y: -paddingCm,
    w: metresToCm(widthMeters) + paddingCm * 2,
    h: metresToCm(heightMeters) + paddingCm * 2,
  };
}

/**
 * Project a screen pixel (from a pointer event's clientX/Y) into plan centimetre
 * coordinates, given the SVG's on-screen rect and its viewBox. Inverts
 * `preserveAspectRatio="xMidYMid meet"` (the renderer's fit): one uniform scale
 * — the smaller of the two axis ratios — with the leftover space on the longer
 * container axis split into centring bars, so a mismatched-aspect (letterboxed)
 * container still projects correctly. Returns the viewBox origin when the rect
 * is degenerate so a zero-size element never yields NaN.
 */
export function screenToPlanCm(clientX: number, clientY: number, viewBox: ViewBox, rect: ScreenRect): FloorPlanPoint {
  const scale = Math.min(rect.width / viewBox.w, rect.height / viewBox.h);
  if (!(scale > 0)) {
    return { x: viewBox.x, y: viewBox.y };
  }
  const offsetX = rect.left + (rect.width - viewBox.w * scale) / 2;
  const offsetY = rect.top + (rect.height - viewBox.h * scale) / 2;
  return {
    x: viewBox.x + (clientX - offsetX) / scale,
    y: viewBox.y + (clientY - offsetY) / scale,
  };
}

/** As {@link screenToPlanCm} but in metres — the unit item/table geometry uses. */
export function screenToPlanMetres(
  clientX: number,
  clientY: number,
  viewBox: ViewBox,
  rect: ScreenRect,
): FloorPlanPoint {
  const cm = screenToPlanCm(clientX, clientY, viewBox, rect);
  return { x: cmToMetres(cm.x), y: cmToMetres(cm.y) };
}

/** The four corners of an oriented rectangle, in metres, clockwise from top-left. */
export function rectCorners(rect: OrientedRect): FloorPlanPoint[] {
  const hw = rect.widthMeters / 2;
  const hh = rect.heightMeters / 2;
  const a = (rect.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([px, py]) => ({
    x: rect.x + px * cos - py * sin,
    y: rect.y + px * sin + py * cos,
  }));
}

interface Vec {
  x: number;
  y: number;
}

function projectionRange(corners: FloorPlanPoint[], axis: Vec): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const dot = c.x * axis.x + c.y * axis.y;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }
  return { min, max };
}

function edgeNormals(corners: FloorPlanPoint[]): Vec[] {
  // A rectangle has two unique edge directions; their normals are the only
  // candidate separating axes it contributes to the SAT test.
  const e1 = { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y };
  const e2 = { x: corners[3].x - corners[0].x, y: corners[3].y - corners[0].y };
  return [
    { x: -e1.y, y: e1.x },
    { x: -e2.y, y: e2.x },
  ];
}

/**
 * Do two oriented rectangles overlap? Separating-axis test — the exact check the
 * editor's overlap warning uses on rotated tables (FLOOR-PLAN-REVAMP §4.3). Two
 * rectangles that only touch at an edge do not count as overlapping.
 */
export function obbOverlap(a: OrientedRect, b: OrientedRect): boolean {
  const ca = rectCorners(a);
  const cb = rectCorners(b);
  for (const axis of [...edgeNormals(ca), ...edgeNormals(cb)]) {
    const ra = projectionRange(ca, axis);
    const rb = projectionRange(cb, axis);
    if (ra.max <= rb.min || rb.max <= ra.min) {
      return false;
    }
  }
  return true;
}
