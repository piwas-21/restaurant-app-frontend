import type { SymbolDef } from './symbolPrims';
import { STRUCTURE_SYMBOLS } from './symbolsStructure';
import { DECOR_SYMBOLS } from './symbolsDecor';
import { isWayfindingKind } from './wayfinding';

export type { SymbolDef, SymbolPrim, SymbolVariant } from './symbolPrims';

/**
 * The floor-plan symbol registry (FLOOR-PLAN-REVAMP §5.3) — the union of the
 * backend `FloorPlanKinds.Items` vocabulary that has *drawn geometry of its own*.
 * A zone region and a text label are not in here: their shape comes from their
 * own footprint and text rather than from an authored box, so they are drawn by
 * {@link ../../components/floor-plan/WayfindingShapes}.
 *
 * `entrance` IS here, because its arrow is an authored box like any other symbol
 * — it is only its *placement layer* that differs (above the tables, §4.4).
 */
export const SYMBOLS: Record<string, SymbolDef> = {
  ...STRUCTURE_SYMBOLS,
  ...DECOR_SYMBOLS,
};

/** The symbol for a kind, or null when the kind has no authored geometry. */
export function getSymbol(kind: string): SymbolDef | null {
  return SYMBOLS[kind] ?? null;
}

/**
 * Is this kind one the editor can move, rotate, resize, copy and delete as a
 * unit? Every drawn object is — including, since S8, the zone regions, text
 * labels and entrance marker, which held out only until the inspector had an
 * affordance for what they carry (their text, their region).
 *
 * This is the one predicate the renderer's interactivity and the editor's hit
 * test share, so the two cannot disagree about what is grabbable.
 */
export const isMovableItemKind = (kind: string): boolean => isWayfindingKind(kind) || getSymbol(kind) !== null;
