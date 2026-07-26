import { getSymbol, type SymbolDef } from './symbols';
import { WAYFINDING_SIZE_M, isWayfindingKind } from './wayfinding';

/**
 * The object palette's **catalogue** (FLOOR-PLAN-REVAMP §4.3) — what the rail
 * offers and at what size. How a placed object is actually born (ids, snapping,
 * clamping, duplication) lives in {@link ./itemPlacement}.
 *
 * **A footprint is never written twice.** Each symbol is authored in its own
 * centimetre box in the renderer's registry (a bar counter is 360 × 70, a stool
 * 40 × 40), so the default metre size is *derived* from that box. A second size
 * table here would be free to drift from the drawing it describes. The wayfinding
 * kinds are the exception, and only because they have no authored box at all —
 * their sizes live in {@link ./wayfinding}, the one place that knows about them.
 */

/** Palette drawers, in rail order. */
export type PaletteGroupId = 'structure' | 'seating' | 'decor' | 'labels';

export interface PaletteGroup {
  id: PaletteGroupId;
  /** Item `kind` tokens, all of which the backend vocabulary already accepts. */
  kinds: readonly string[];
}

/**
 * Walls, doors-in-walls and windows are missing on purpose — an opening belongs
 * to a wall segment, so it is created from the wall tool and its panel (S7).
 * `door_free` is the free-standing door that needs no wall.
 */
export const PALETTE_GROUPS: readonly PaletteGroup[] = [
  { id: 'structure', kinds: ['bar_counter', 'kitchen_pass', 'wc', 'stairs', 'column', 'door_free', 'divider'] },
  { id: 'seating', kinds: ['banquette', 'sofa', 'armchair', 'bar_stool'] },
  { id: 'decor', kinds: ['plant_small', 'plant_large', 'tree', 'rug', 'fireplace', 'piano'] },
  // `label` is the older spelling of `text_label` and draws identically, so only
  // one of the two is ever offered.
  { id: 'labels', kinds: ['text_label', 'zone', 'entrance'] },
];

/** Every placeable kind, flattened. */
export const PALETTE_KINDS: readonly string[] = PALETTE_GROUPS.flatMap((group) => group.kinds);

/** The natural footprint of a kind in metres, read off its authored symbol box. */
export function defaultItemSize(kind: string): { widthMeters: number; heightMeters: number } {
  const symbol = getSymbol(kind);
  if (symbol) {
    return { widthMeters: symbol.w / 100, heightMeters: symbol.h / 100 };
  }
  // A kind with no drawn geometry would render as nothing; a 1 m square at least
  // stays selectable, so it can be deleted rather than being invisibly stuck.
  return WAYFINDING_SIZE_M[kind] ?? { widthMeters: 1, heightMeters: 1 };
}

/**
 * A rail entry: the kind, the size it lands at, and the symbol that draws it —
 * **absent for a wayfinding kind**, whose preview is the real shape the layer
 * draws rather than an authored box (see `EditorPalette`).
 */
export interface PaletteEntry {
  kind: string;
  symbol: SymbolDef | null;
  widthMeters: number;
  heightMeters: number;
}

/**
 * A group's entries, resolved. A kind that has neither a drawn symbol nor a
 * wayfinding shape is **not offered** — so the rail can never advertise
 * something that would land invisible, and the component needs no defensive
 * branch of its own.
 */
export const paletteEntries = (group: PaletteGroup): PaletteEntry[] =>
  group.kinds.flatMap((kind) => {
    const symbol = getSymbol(kind);
    if (!symbol && !isWayfindingKind(kind)) {
      return [];
    }
    return [{ kind, symbol, ...defaultItemSize(kind) }];
  });
