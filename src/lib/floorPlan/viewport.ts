import type { ViewBox } from './geometry';

/**
 * Pure viewBox arithmetic for the guest map's zoom / pan (FLOOR-PLAN-REVAMP
 * §4.2). Zoom is a viewBox resize about a focal point; pan is a translate; both
 * are clamped so the plan can never be zoomed out past its fitted frame or
 * panned off into empty space. Kept pure so the interaction hook stays a thin
 * event-wiring layer and the maths is unit-tested.
 */

/** Smallest visible span in centimetres (≈ 0.6 m) — the zoom-in limit. */
export const MIN_SPAN_CM = 60;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Clamp a viewBox to sit within `bounds` (the fitted frame): never larger than
 * the frame on either axis, and never translated past its edges.
 */
export function clampViewBox(vb: ViewBox, bounds: ViewBox): ViewBox {
  const w = Math.min(vb.w, bounds.w);
  const h = Math.min(vb.h, bounds.h);
  const x = clamp(vb.x, bounds.x, bounds.x + bounds.w - w);
  const y = clamp(vb.y, bounds.y, bounds.y + bounds.h - h);
  return { x, y, w, h };
}

/**
 * Zoom by `factor` (>1 zooms in) about a focal point in plan centimetres, so the
 * point under the cursor stays put. Clamped between {@link MIN_SPAN_CM} and the
 * fitted frame, then re-clamped for pan.
 */
export function zoomViewBox(vb: ViewBox, factor: number, focus: { x: number; y: number }, bounds: ViewBox): ViewBox {
  const targetW = clamp(vb.w / factor, MIN_SPAN_CM, bounds.w);
  const scale = targetW / vb.w;
  const w = targetW;
  const h = vb.h * scale;
  const x = focus.x - (focus.x - vb.x) * scale;
  const y = focus.y - (focus.y - vb.y) * scale;
  return clampViewBox({ x, y, w, h }, bounds);
}

/** Translate the viewBox by a plan-centimetre delta, clamped to the frame. */
export function panViewBox(vb: ViewBox, dxCm: number, dyCm: number, bounds: ViewBox): ViewBox {
  return clampViewBox({ ...vb, x: vb.x - dxCm, y: vb.y - dyCm }, bounds);
}

/** Whether the viewBox is zoomed in relative to the fitted frame (pan is meaningful). */
export const isZoomed = (vb: ViewBox, bounds: ViewBox): boolean => vb.w < bounds.w - 0.5 || vb.h < bounds.h - 0.5;
