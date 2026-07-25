import { itemKindLabel } from './itemKindLabel';

/** A `t` that always misses, so the fallback is what gets asserted. */
const missing = (_key: string, fallback: string) => fallback;

describe('itemKindLabel', () => {
  it('uses the locale value when the key exists', () => {
    const t = (key: string) => (key === 'editor_item_tree' ? 'Boom' : 'nope');
    expect(itemKindLabel(t, 'tree')).toBe('Boom');
  });

  it('falls back to the symbol registry’s own name, not the raw key', () => {
    expect(itemKindLabel(missing, 'bar_counter')).toBe('Bar counter');
  });

  it('falls back to the kind token for something the registry has never heard of', () => {
    expect(itemKindLabel(missing, 'not_a_kind')).toBe('not_a_kind');
  });
});
