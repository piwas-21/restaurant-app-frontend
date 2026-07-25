import type { SymbolDef } from './symbolPrims';
import { STRUCTURE_SYMBOLS } from './symbolsStructure';
import { DECOR_SYMBOLS } from './symbolsDecor';

export type { SymbolDef, SymbolPrim, SymbolVariant } from './symbolPrims';

/**
 * The floor-plan symbol registry (FLOOR-PLAN-REVAMP §5.3) — the union of the
 * backend `FloorPlanKinds.Items` vocabulary rendered by the scene. `label`,
 * `text_label`, `zone` and `entrance` are handled by dedicated layers (they
 * carry text or a footprint), so they are not in this geometry table.
 */
export const SYMBOLS: Record<string, SymbolDef> = {
  ...STRUCTURE_SYMBOLS,
  ...DECOR_SYMBOLS,
};

/** The symbol for a kind, or null when the kind has no drawn geometry. */
export function getSymbol(kind: string): SymbolDef | null {
  return SYMBOLS[kind] ?? null;
}

/**
 * Kinds another layer owns: they carry text or a region rather than a symbol, so
 * `LabelsLayer` / `ItemsLayer`'s zone branch draw them from their own geometry.
 */
const OTHER_LAYERS = new Set(['label', 'text_label', 'entrance', 'zone']);

/**
 * Is this kind a plain positioned symbol — the objects the editor moves, rotates,
 * resizes, copies and deletes as a unit? A zone region, a text label and the
 * entrance marker are all *editable*, but each needs affordances of its own (its
 * text, its region), which arrive with S8; until then they must not be draggable
 * through a panel that cannot edit them. This is the one predicate the renderer's
 * interactivity and the editor's hit test share, so the two cannot disagree about
 * what is grabbable.
 */
export const isSymbolItemKind = (kind: string): boolean => !OTHER_LAYERS.has(kind) && getSymbol(kind) !== null;
