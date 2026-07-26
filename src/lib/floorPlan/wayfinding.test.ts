import {
  DEFAULT_ITEM_LABEL,
  WAYFINDING_KINDS,
  WAYFINDING_SIZE_M,
  carriesText,
  isTextLabelKind,
  isWayfindingKind,
} from './wayfinding';
import { getSymbol, isMovableItemKind } from './symbols';

describe('wayfinding — the kind set', () => {
  it.each([...WAYFINDING_KINDS])('recognises %s', (kind) => {
    expect(isWayfindingKind(kind)).toBe(true);
  });

  it('claims nothing else', () => {
    expect(isWayfindingKind('bar_counter')).toBe(false);
    expect(isWayfindingKind('not_a_kind')).toBe(false);
  });

  // Everything in here has to be movable, or the set would name kinds the
  // editor still cannot touch — which was exactly the pre-S8 state.
  it.each([...WAYFINDING_KINDS])('makes %s movable', (kind) => {
    expect(isMovableItemKind(kind)).toBe(true);
  });
});

describe('wayfinding — the two spellings of a text label', () => {
  it('treats `label` and `text_label` as one kind', () => {
    expect(isTextLabelKind('label')).toBe(true);
    expect(isTextLabelKind('text_label')).toBe(true);
  });

  it('does not confuse a zone for one', () => {
    expect(isTextLabelKind('zone')).toBe(false);
  });
});

describe('wayfinding — which kinds carry text', () => {
  it.each(['zone', 'text_label', 'label'])('%s does', (kind) => {
    expect(carriesText(kind)).toBe(true);
  });

  it('the entrance does not — it carries a direction, not a name', () => {
    expect(carriesText('entrance')).toBe(false);
  });

  it('nor does an ordinary object', () => {
    expect(carriesText('plant_small')).toBe(false);
  });
});

describe('wayfinding — footprints', () => {
  // The sizes live here ONLY for the kinds with no authored symbol box; anything
  // that has one must derive from it, or the two would be free to drift.
  it('sizes exactly the kinds the symbol registry cannot size', () => {
    const sized = Object.keys(WAYFINDING_SIZE_M);
    sized.forEach((kind) => expect(getSymbol(kind)).toBeNull());
    expect(sized).not.toContain('entrance');
    expect(getSymbol('entrance')).not.toBeNull();
  });

  it('gives a zone room for a few tables and a label the tape proportions', () => {
    expect(WAYFINDING_SIZE_M.zone).toEqual({ widthMeters: 3, heightMeters: 2 });
    expect(WAYFINDING_SIZE_M.text_label.widthMeters).toBeGreaterThan(WAYFINDING_SIZE_M.text_label.heightMeters);
  });

  it('starts every text-carrying kind with placeholder text, so none draws an empty box', () => {
    Object.keys(WAYFINDING_SIZE_M).forEach((kind) => expect(DEFAULT_ITEM_LABEL[kind]).toBeTruthy());
    expect(DEFAULT_ITEM_LABEL.entrance).toBeUndefined();
  });
});
