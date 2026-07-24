/**
 * Snapping maths for the admin editor (FLOOR-PLAN-REVAMP §4.3). Grid snap,
 * edge/centre alignment guides, and rotation-angle snapping — all pure, in
 * metres/degrees, so the editor hook stays a thin event layer and "the plan
 * finally matches the room" is unit-tested. The tolerance is passed in metres
 * (the caller converts a screen-pixel threshold through the current zoom, so
 * snapping feels identical at any zoom — §4.4).
 */

/** A movable item's centre + footprint in metres. */
export interface SnapRect {
  x: number;
  y: number;
  widthMeters: number;
  heightMeters: number;
}

/** An alignment guide to draw: a full-span line at `atMeters` on one axis. */
export interface AlignmentGuide {
  axis: 'x' | 'y';
  atMeters: number;
}

export interface AlignmentResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

/** Round a metre value to the grid; a no-op when snapping is off. */
export function snapToGrid(valueMeters: number, gridSizeCm: number, enabled = true): number {
  if (!enabled || gridSizeCm <= 0) {
    return valueMeters;
  }
  const step = gridSizeCm / 100;
  return Math.round(valueMeters / step) * step;
}

/** The three snap candidates on an axis: near edge, centre, far edge. */
function axisMarks(centre: number, half: number): number[] {
  return [centre - half, centre, centre + half];
}

const axisHalf = (rect: SnapRect, axis: 'x' | 'y'): number => (axis === 'x' ? rect.widthMeters : rect.heightMeters) / 2;

/** The closest edge/centre alignment on one axis, or null when none is in range. */
function bestSnapOnAxis(
  targetMarks: number[],
  others: SnapRect[],
  axis: 'x' | 'y',
  toleranceMeters: number,
): { delta: number; at: number } | null {
  let best: { delta: number; at: number; distance: number } | null = null;
  for (const other of others) {
    for (const candidate of axisMarks(other[axis], axisHalf(other, axis))) {
      for (const mark of targetMarks) {
        const distance = Math.abs(candidate - mark);
        if (distance <= toleranceMeters && (!best || distance < best.distance)) {
          best = { delta: candidate - mark, at: candidate, distance };
        }
      }
    }
  }
  return best && { delta: best.delta, at: best.at };
}

/**
 * Snap a target's centre so one of its edges/centre lines up with another item's
 * edge/centre, within `toleranceMeters`. Returns the adjusted centre plus a guide
 * line per snapped axis. Picks the closest candidate on each axis independently.
 */
export function alignmentSnap(target: SnapRect, others: SnapRect[], toleranceMeters: number): AlignmentResult {
  const result: AlignmentResult = { x: target.x, y: target.y, guides: [] };
  for (const axis of ['x', 'y'] as const) {
    const marks = axisMarks(target[axis], axisHalf(target, axis));
    const snap = bestSnapOnAxis(marks, others, axis, toleranceMeters);
    if (snap) {
      result[axis] = target[axis] + snap.delta;
      result.guides.push({ axis, atMeters: snap.at });
    }
  }
  return result;
}

export const ROTATION_STEP_FREE = 1;
export const ROTATION_STEP_DEFAULT = 15;
export const ROTATION_STEP_COARSE = 90;

/** The rotation snap increment for the held modifiers (Alt = 90°, Shift = 1°, else 15°). */
export function rotationStep(modifiers: { shift?: boolean; alt?: boolean }): number {
  if (modifiers.alt) {
    return ROTATION_STEP_COARSE;
  }
  if (modifiers.shift) {
    return ROTATION_STEP_FREE;
  }
  return ROTATION_STEP_DEFAULT;
}

/** Snap an angle (degrees) to the nearest step, normalised to [0, 360). */
export function snapAngle(angleDeg: number, stepDeg: number): number {
  const step = stepDeg > 0 ? stepDeg : 1;
  return (((Math.round(angleDeg / step) * step) % 360) + 360) % 360;
}
