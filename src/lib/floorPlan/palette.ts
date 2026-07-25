import { getSymbol, type SymbolDef } from './symbols';

/**
 * The object palette's **catalogue** (FLOOR-PLAN-REVAMP §4.3) — what the rail
 * offers and at what size. How a placed object is actually born (ids, snapping,
 * clamping, duplication) lives in {@link ./itemPlacement}.
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

/** The natural footprint of a kind in metres, read off its authored symbol box. */
export function defaultItemSize(kind: string): { widthMeters: number; heightMeters: number } {
  const symbol = getSymbol(kind);
  // A kind with no drawn geometry would render as nothing; a 1 m square at least
  // stays selectable, so it can be deleted rather than being invisibly stuck.
  return symbol ? { widthMeters: symbol.w / 100, heightMeters: symbol.h / 100 } : { widthMeters: 1, heightMeters: 1 };
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
