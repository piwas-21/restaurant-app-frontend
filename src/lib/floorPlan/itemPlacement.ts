import type { FloorPlanDocument, FloorPlanItem, FloorPlanPoint } from '@/types/floorPlan';
import { addItem } from './document';
import { clampCentreToPlan } from './editorGeometry';
import { nextLocalItemId } from './localIds';
import { defaultItemSize } from './palette';
import { snapToGrid } from './snapping';
import { DEFAULT_ITEM_LABEL } from './wayfinding';

/**
 * How a placed object is born (FLOOR-PLAN-REVAMP §4.3) — click-to-place, copy,
 * and the ids that hold it together until Save. Click-to-place is not a
 * convenience: it is the SC 2.5.7 compliance path, which is why placement here is
 * a pure function of a *point* rather than of a drag. What the rail offers is the
 * catalogue's job ({@link ./palette}).
 *
 * An item lives entirely in the local document until Save, because the
 * whole-document PUT replaces walls and items wholesale — so unlike a table
 * (identity, QR and lifecycle on /api/tables) an item needs no API call to exist.
 */

/** The server's per-plan item cap (`SaveFloorPlanCommandValidator`) — a save past it is a 400. */
export const MAX_PLAN_ITEMS = 500;

/**
 * Client-minted ids live in {@link ./localIds} — walls and openings mint them
 * too since S7, and the save path needs ONE predicate that covers every kind.
 * Re-exported here because item placement is where callers already look for them.
 */
export { isLocalId, nextLocalItemId } from './localIds';

/** One above the highest z in the plan, so a new object lands on top of the pile. */
const topZIndex = (doc: FloorPlanDocument): number =>
  doc.items.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1;

interface PlaceOptions {
  /** Snap the centre onto the plan grid (the toolbar's snap toggle). */
  snapEnabled?: boolean;
}

/**
 * A new item of `kind`, centred on the clicked point: snapped to the grid, sized
 * from its symbol, and clamped into the plan exactly as a drag would be, so what
 * lands on the canvas is what Save keeps.
 */
export function newItem(
  kind: string,
  point: FloorPlanPoint,
  doc: FloorPlanDocument,
  { snapEnabled = true }: PlaceOptions = {},
): FloorPlanItem {
  const size = defaultItemSize(kind);
  const snapped = snapEnabled
    ? { x: snapToGrid(point.x, doc.gridSizeCm), y: snapToGrid(point.y, doc.gridSizeCm) }
    : point;
  const centre = clampCentreToPlan(snapped.x, snapped.y, doc);
  return {
    id: nextLocalItemId(doc),
    kind,
    x: centre.x,
    y: centre.y,
    widthMeters: Math.min(size.widthMeters, doc.widthMeters),
    heightMeters: Math.min(size.heightMeters, doc.heightMeters),
    rotationDegrees: 0,
    zIndex: topZIndex(doc),
    // A zone or a text label with no text draws as an empty box, which reads as
    // broken rather than as "type something here" — so it lands with a
    // placeholder the inspector's text field is already pointing at.
    label: DEFAULT_ITEM_LABEL[kind] ?? null,
    styleVariant: null,
  };
}

/**
 * A copy of `item`, offset by one grid unit down-right so the duplicate is
 * visibly its own object rather than hiding under the original. Duplication is
 * how you place a row of the same thing (⌘D), which is why click-to-place stays
 * single-shot.
 */
export function duplicateItem(item: FloorPlanItem, doc: FloorPlanDocument): FloorPlanItem {
  const step = doc.gridSizeCm / 100;
  const centre = clampCentreToPlan(item.x + step, item.y + step, doc);
  return { ...item, id: nextLocalItemId(doc), x: centre.x, y: centre.y, zIndex: topZIndex(doc) };
}

/** Is there room for another item, or would the save be rejected as too big? */
export const canPlaceItem = (doc: FloorPlanDocument): boolean => doc.items.length < MAX_PLAN_ITEMS;

/**
 * A centre no item already sits on, stepping down-right by one grid unit — the
 * same offset {@link duplicateItem} uses, for the same reason: two objects at
 * identical coordinates are indistinguishable on the plan.
 *
 * The pointer-less placement path needs this because it has no click to vary the
 * position, so a keyboard user placing three stools would otherwise stack all
 * three on the exact same spot. A *click* is left alone — the user pointed there.
 * The walk is bounded by the item count, so a saturated plan settles rather than
 * spinning.
 */
export function freeCentre(doc: FloorPlanDocument, point: FloorPlanPoint): FloorPlanPoint {
  const step = doc.gridSizeCm / 100;
  let candidate = point;
  for (let attempt = 0; attempt <= doc.items.length; attempt++) {
    if (!doc.items.some((item) => item.x === candidate.x && item.y === candidate.y)) {
      return candidate;
    }
    candidate = clampCentreToPlan(candidate.x + step, candidate.y + step, doc);
  }
  return candidate;
}

/**
 * Place a new item and report its id, so the editor can select what it just
 * created. Returns null when the plan is already at the server's item cap —
 * refusing here beats a save that fails after the work is done.
 */
export function placeItem(
  doc: FloorPlanDocument,
  kind: string,
  point: FloorPlanPoint,
  options?: PlaceOptions,
): { document: FloorPlanDocument; id: string } | null {
  if (!canPlaceItem(doc)) {
    return null;
  }
  const item = newItem(kind, point, doc, options);
  // Non-null: `newItem` always mints an id.
  return { document: addItem(doc, item), id: item.id! };
}

/**
 * Duplicate every item named by `ids`, threading the growing document so each
 * copy gets its own id. Returns the new ids for the caller to select — the copies
 * become the selection, as in every design tool, so a second ⌘D walks a row.
 */
export function duplicateItems(
  doc: FloorPlanDocument,
  ids: readonly string[],
): { document: FloorPlanDocument; ids: string[] } {
  const picked = doc.items.filter((item) => item.id && ids.includes(item.id));
  return picked.reduce<{ document: FloorPlanDocument; ids: string[] }>(
    (acc, item) => {
      if (!canPlaceItem(acc.document)) {
        return acc;
      }
      const copy = duplicateItem(item, acc.document);
      // Non-null: `duplicateItem` always mints an id.
      return { document: addItem(acc.document, copy), ids: [...acc.ids, copy.id!] };
    },
    { document: doc, ids: [] },
  );
}
