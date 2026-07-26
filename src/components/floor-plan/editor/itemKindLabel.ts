import { getSymbol } from '@/lib/floorPlan/symbols';
import { isTextLabelKind } from '@/lib/floorPlan/wayfinding';

/**
 * The human name of an item kind (FLOOR-PLAN-REVAMP §4.3). Used by the palette
 * rail, the inspector heading and the canvas's accessible labels — one helper, so
 * the same object is never called two different things on the same screen.
 *
 * The **symbol registry's own English name is the fallback**, so a kind that
 * reaches the UI before its locale key exists still reads as a word rather than
 * as `editor_item_bar_counter`.
 *
 * `label` is the backend vocabulary's older spelling of `text_label` and draws
 * identically, so both resolve to the one name — the palette offers a single
 * entry and the inspector must not call a stored `label` something else.
 */
type Translate = (key: string, fallback: string) => string;

const ENGLISH_FALLBACK: Readonly<Record<string, string>> = {
  text_label: 'Text label',
  zone: 'Zone',
  entrance: 'Entrance',
};

export const itemKindLabel = (t: Translate, kind: string): string => {
  const canonical = isTextLabelKind(kind) ? 'text_label' : kind;
  return t(`editor_item_${canonical}`, ENGLISH_FALLBACK[canonical] ?? getSymbol(canonical)?.name ?? canonical);
};
