import type { FloorPlanDocument, FloorPlanOpening, FloorPlanOpeningKind, FloorPlanWall } from '@/types/floorPlan';
import { nextLocalOpeningId } from './localIds';
import { wallSegments } from './walls';

/**
 * Doors, windows and plain gaps (FLOOR-PLAN-REVAMP §4.3). An opening is **placed
 * on a wall segment** — an index along the chain plus an offset and a width in
 * metres — rather than being a free-floating object, which is what makes it
 * structurally impossible for a door to drift off its wall. That is the whole
 * reason they are not palette items.
 *
 * Everything here keeps the opening inside its segment, so the renderer never has
 * to defend against a doorway hanging off the end of the wall it belongs to.
 */

export const OPENING_KINDS: readonly FloorPlanOpeningKind[] = ['door', 'window', 'opening'];

/** Which way a door leaf swings. Windows and gaps carry `none`. */
export const SWING_DIRECTIONS = ['in', 'out', 'none'] as const;
export type SwingDirection = (typeof SWING_DIRECTIONS)[number];

/** Real-world defaults: a single door leaf, a typical window, a wide archway. */
export const DEFAULT_OPENING_WIDTH_M: Readonly<Record<FloorPlanOpeningKind, number>> = {
  door: 0.9,
  window: 1.2,
  opening: 1.4,
};

/** `SaveFloorPlanCommandValidator` rejects a wall with more than this many openings. */
export const MAX_WALL_OPENINGS = 50;

/** The narrowest opening worth drawing; below this it reads as a rendering artefact. */
export const MIN_OPENING_WIDTH_M = 0.2;

/**
 * Clamp an opening so it sits wholly within its segment. Width is capped by the
 * segment first, then the offset by whatever room the width left — in that order,
 * because the reverse lets a wide opening push its own offset negative.
 */
export function fitOpening(
  segmentLength: number,
  offsetMeters: number,
  widthMeters: number,
): { offsetMeters: number; widthMeters: number } {
  const width = Math.min(Math.max(widthMeters, MIN_OPENING_WIDTH_M), segmentLength);
  const offset = Math.min(Math.max(offsetMeters, 0), Math.max(segmentLength - width, 0));
  return { offsetMeters: offset, widthMeters: width };
}

/**
 * Add an opening, centred on its segment. Returns the wall unchanged when the
 * segment doesn't exist, is too short to hold the narrowest opening, or the wall
 * is already at the server's cap — refusing here beats a save that 400s after the
 * work is done.
 */
export function addWallOpening(
  doc: FloorPlanDocument,
  wall: FloorPlanWall,
  segmentIndex: number,
  kind: FloorPlanOpeningKind,
): FloorPlanWall {
  const segment = wallSegments(wall)[segmentIndex];
  if (!segment || segment.length < MIN_OPENING_WIDTH_M || wall.openings.length >= MAX_WALL_OPENINGS) {
    return wall;
  }
  const desired = DEFAULT_OPENING_WIDTH_M[kind];
  const fitted = fitOpening(segment.length, (segment.length - desired) / 2, desired);
  const opening: FloorPlanOpening = {
    id: nextLocalOpeningId(doc),
    segmentIndex,
    kind,
    swingDirection: kind === 'door' ? 'in' : 'none',
    ...fitted,
  };
  return { ...wall, openings: [...wall.openings, opening] };
}

/**
 * Patch one opening by id, re-fitting it to whichever segment it ends up on — a
 * move to a shorter side has to bring the opening with it, not leave it hanging
 * past the end.
 */
export function updateWallOpening(
  wall: FloorPlanWall,
  openingId: string,
  patch: Partial<FloorPlanOpening>,
): FloorPlanWall {
  // Identity on a miss, so a no-op never reaches the undo stack as an entry that
  // undoes nothing — the caller's "did this change anything?" test is `!==`.
  if (!wall.openings.some((opening) => opening.id === openingId)) {
    return wall;
  }
  const segments = wallSegments(wall);
  return {
    ...wall,
    openings: wall.openings.map((opening) => {
      if (opening.id !== openingId) {
        return opening;
      }
      const merged = { ...opening, ...patch };
      const segment = segments[merged.segmentIndex];
      if (!segment) {
        return opening;
      }
      // A kind change carries its own natural width unless the patch named one,
      // so switching a window to a door doesn't leave a 1.2 m door leaf behind.
      const width =
        patch.widthMeters ??
        (patch.kind && patch.kind !== opening.kind ? DEFAULT_OPENING_WIDTH_M[patch.kind] : merged.widthMeters);
      return { ...merged, ...fitOpening(segment.length, merged.offsetMeters, width) };
    }),
  };
}

/** Drop an opening, or return the wall untouched when it had no such opening. */
export function removeWallOpening(wall: FloorPlanWall, openingId: string): FloorPlanWall {
  const kept = wall.openings.filter((opening) => opening.id !== openingId);
  return kept.length === wall.openings.length ? wall : { ...wall, openings: kept };
}

/** Is there room for another opening on this wall? The panel says so. */
export const canAddOpening = (wall: FloorPlanWall): boolean => wall.openings.length < MAX_WALL_OPENINGS;

/** The index of the longest side — where an added opening lands by default. */
export function longestSegmentIndex(wall: FloorPlanWall): number {
  return wallSegments(wall).reduce(
    (best, segment, index, all) => (segment.length > all[best].length ? index : best),
    0,
  );
}
