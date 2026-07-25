import type { FloorPlanDocument, FloorPlanItem, FloorPlanPoint } from '@/types/floorPlan';
import { addItem } from './document';
import { clampCentreToPlan } from './editorGeometry';
import { snapToGrid } from './snapping';
import { getSymbol, type SymbolDef } from './symbols';

/**
 * The object palette (FLOOR-PLAN-REVAMP §4.3) — what can be placed on a plan, and
 * what a freshly placed object looks like. Click-to-place is not a convenience
 * here: it is the SC 2.5.7 compliance path, so placement is a pure function of a
 * point rather than of a drag.
 *
 * **A footprint is never written twice.** Each symbol is authored in its own
 * centimetre box in the renderer's registry (a bar counter is 360 × 70, a stool
 * 40 × 40), so the default metre size is *derived* from that box. A second size
 * table here would be free to drift from the drawing it describes.
 *
 * Zone regions, text labels and the entrance marker are deliberately absent: they
 * carry text or a region rather than a symbol, and land with S8.
 */

/** Palette drawers, in rail order. */
export type PaletteGroupId = 'structure' | 'seating' | 'decor';

export interface PaletteGroup {
  id: PaletteGroupId;
  /** Item `kind` tokens, all of which the backend vocabulary already accepts. */
  kinds: readonly string[];
}

/**
 * Walls, doors-in-walls and windows are missing on purpose — an opening belongs
 * to a wall segment, so they arrive with the wall tool (S7). `door_free` is the
 * free-standing door that needs no wall.
 */
export const PALETTE_GROUPS: readonly PaletteGroup[] = [
  { id: 'structure', kinds: ['bar_counter', 'kitchen_pass', 'wc', 'stairs', 'column', 'door_free', 'divider'] },
  { id: 'seating', kinds: ['banquette', 'sofa', 'armchair', 'bar_stool'] },
  { id: 'decor', kinds: ['plant_small', 'plant_large', 'tree', 'rug', 'fireplace', 'piano'] },
];

/** Every placeable kind, flattened. */
export const PALETTE_KINDS: readonly string[] = PALETTE_GROUPS.flatMap((group) => group.kinds);

/** The server's per-plan item cap (`SaveFloorPlanCommandValidator`) — a save past it is a 400. */
export const MAX_PLAN_ITEMS = 500;

/** The prefix of an id the editor minted; the server re-mints every item on save. */
const LOCAL_ID_PREFIX = 'local-item-';

/** The natural footprint of a kind in metres, read off its authored symbol box. */
export function defaultItemSize(kind: string): { widthMeters: number; heightMeters: number } {
  const symbol = getSymbol(kind);
  // A kind with no drawn geometry would render as nothing; a 1 m square at least
  // stays selectable, so it can be deleted rather than being invisibly stuck.
  return symbol ? { widthMeters: symbol.w / 100, heightMeters: symbol.h / 100 } : { widthMeters: 1, heightMeters: 1 };
}

/**
 * The next free local id. Derived from the ids already in the document rather
 * than a module counter, so it survives undo/redo and a reload without ever
 * colliding — and so placement stays a pure function.
 */
export function nextLocalItemId(doc: FloorPlanDocument): string {
  const used = doc.items.reduce((max, item) => {
    const suffix = item.id?.startsWith(LOCAL_ID_PREFIX) ? Number(item.id.slice(LOCAL_ID_PREFIX.length)) : NaN;
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
  return `${LOCAL_ID_PREFIX}${used + 1}`;
}

/** A rail entry: the kind, the symbol that draws it, and the size it lands at. */
export interface PaletteEntry {
  kind: string;
  symbol: SymbolDef;
  widthMeters: number;
  heightMeters: number;
}

/**
 * A group's entries, resolved. A kind with no drawn symbol is **not offered** —
 * so the rail can never advertise something that would land invisible, and the
 * component needs no defensive branch of its own.
 */
export const paletteEntries = (group: PaletteGroup): PaletteEntry[] =>
  group.kinds.flatMap((kind) => {
    const symbol = getSymbol(kind);
    return symbol ? [{ kind, symbol, ...defaultItemSize(kind) }] : [];
  });

/** Is this id one the editor minted (i.e. not yet saved)? */
export const isLocalItemId = (id: string): boolean => id.startsWith(LOCAL_ID_PREFIX);

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
    label: null,
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
