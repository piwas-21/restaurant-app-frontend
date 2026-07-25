import { getSymbol } from '@/lib/floorPlan/symbols';

/**
 * The human name of an item kind (FLOOR-PLAN-REVAMP §4.3). Used by the palette
 * rail, the inspector heading and the canvas's accessible labels — one helper, so
 * the same object is never called two different things on the same screen.
 *
 * The **symbol registry's own English name is the fallback**, so a kind that
 * reaches the UI before its locale key exists still reads as a word rather than
 * as `editor_item_bar_counter`.
 */
type Translate = (key: string, fallback: string) => string;

export const itemKindLabel = (t: Translate, kind: string): string =>
  t(`editor_item_${kind}`, getSymbol(kind)?.name ?? kind);
