import type { FloorPlanDocument, FloorPlanPoint } from '@/types/floorPlan';
import { obbOverlap, type OrientedRect } from './geometry';
import { documentMovables, type Movable } from './movable';

/**
 * Multi-selection maths for the admin editor (FLOOR-PLAN-REVAMP §4.3). Selection
 * is an ordered id list over **everything movable** — tables and placed items
 * alike — and order matters because align/distribute read the group's bounding
 * box in it. Pure, so "shift-click toggles" and "the band picks what it touches"
 * are unit-tested rather than inferred from pointer handlers.
 */

/** A rubber band in plan metres, normalised so width/height are never negative. */
export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The band between two corners, whichever way round they were dragged. */
export const marqueeBetween = (a: FloorPlanPoint, b: FloorPlanPoint): MarqueeRect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/**
 * Add, remove or replace `id` in a selection. A plain click selects just that
 * table; a shift-click toggles it, which is the only way to *deselect* one table
 * out of several without starting the selection over.
 */
export function toggleSelection(ids: readonly string[], id: string, additive: boolean): string[] {
  if (!additive) {
    return [id];
  }
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

/**
 * Drop ids that are no longer in the document — after a delete, an undo, or a
 * Save (which re-mints every item id server-side, so a placed item's local id
 * legitimately stops existing the moment the plan comes back).
 */
export const pruneSelection = (ids: readonly string[], doc: FloorPlanDocument): string[] => {
  const live = documentMovables(doc);
  return ids.filter((id) => live.some((m) => m.id === id));
};

/** The band as an oriented rect, so one overlap test covers rotated tables too. */
const bandRect = (band: MarqueeRect): OrientedRect => ({
  x: band.x + band.width / 2,
  y: band.y + band.height / 2,
  widthMeters: band.width,
  heightMeters: band.height,
  rotationDegrees: 0,
});

/**
 * Ids of every movable the band *touches* — intersection, not containment, so a
 * quick sweep across a row picks the row up instead of demanding the band
 * swallow each table whole. A zero-area band (a click that never dragged)
 * touches nothing.
 */
export const idsInMarquee = (movables: readonly Movable[], band: MarqueeRect): string[] =>
  movables.filter((m) => obbOverlap(m, bandRect(band))).map((m) => m.id);
