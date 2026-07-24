import type { FloorPlanPoint, FloorPlanTableGeometry } from '@/types/floorPlan';
import { obbOverlap, type OrientedRect } from './geometry';
import { tableOrientedRect } from './editorGeometry';

/**
 * Multi-selection maths for the admin editor (FLOOR-PLAN-REVAMP §4.3). Selection
 * is an ordered id list — order matters because the first-picked table is the
 * one align/distribute treats as the anchor of the group's bounding box. Pure,
 * so "shift-click toggles" and "the band picks what it touches" are unit-tested
 * rather than inferred from pointer handlers.
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

/** Drop ids that are no longer in the document — e.g. after a delete or reload. */
export const pruneSelection = (ids: readonly string[], tables: readonly FloorPlanTableGeometry[]): string[] =>
  ids.filter((id) => tables.some((t) => t.id === id));

/** The band as an oriented rect, so one overlap test covers rotated tables too. */
const bandRect = (band: MarqueeRect): OrientedRect => ({
  x: band.x + band.width / 2,
  y: band.y + band.height / 2,
  widthMeters: band.width,
  heightMeters: band.height,
  rotationDegrees: 0,
});

/**
 * Ids of every table the band *touches* — intersection, not containment, so a
 * quick sweep across a row picks the row up instead of demanding the band
 * swallow each table whole. A zero-area band (a click that never dragged)
 * touches nothing.
 */
export const idsInMarquee = (tables: readonly FloorPlanTableGeometry[], band: MarqueeRect): string[] =>
  tables.filter((t) => obbOverlap(tableOrientedRect(t), bandRect(band))).map((t) => t.id);
