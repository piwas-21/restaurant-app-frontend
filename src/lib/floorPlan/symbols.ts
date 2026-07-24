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
