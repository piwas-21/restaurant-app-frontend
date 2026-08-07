import { getAllergenInfo, AVAILABLE_ALLERGENS } from '@/lib/allergens';

/**
 * The vocabulary is shared by both templates, so a miss shows up as an unlabelled
 * chip on every menu card. That is what it was doing for the demo tenant: its four
 * distinct allergens are bare EU-14 substance names, none of which the table held,
 * so all four rendered the same generic glyph.
 *
 * These assertions used to pin ICONS — the table carried 25 emoji, and "four
 * different icons" was how the demo-tenant miss was caught. D9 removed them (a
 * substance warning earns one monochrome glyph, a dietary claim earns none), so the
 * same property is now pinned on `canonical`: what the four resolve TO, which is
 * what the guest reads and what the alias table exists to compute. Loosening these
 * to `kind` alone would have made every spelling case below pass by construction —
 * `dairy` and `milk` would agree just by both being warnings.
 */

describe('getAllergenInfo — dietary claims (the admin form vocabulary)', () => {
  it.each(AVAILABLE_ALLERGENS)('recognises %s, the values the product editor offers', (allergen) => {
    expect(getAllergenInfo(allergen).kind).not.toBe('unknown');
  });

  it('keeps a _free claim distinct from the substance it excludes', () => {
    expect(getAllergenInfo('gluten_free')).toEqual({ kind: 'claim', canonical: 'gluten_free' });
    expect(getAllergenInfo('gluten')).toEqual({ kind: 'substance', canonical: 'gluten' });
  });

  it('reads spicy as a claim, not one of the 14 substances a menu must declare', () => {
    expect(getAllergenInfo('spicy')).toEqual({ kind: 'claim', canonical: 'spicy' });
    // …and via its alias, which is the only input that reaches the claim branch
    // through the alias table rather than directly.
    expect(getAllergenInfo('hot')).toEqual({ kind: 'claim', canonical: 'spicy' });
  });
});

describe('getAllergenInfo — bare substance names (how menus are actually written)', () => {
  const EU14 = [
    'gluten',
    'crustaceans',
    'eggs',
    'fish',
    'peanuts',
    'soy',
    'milk',
    'nuts',
    'celery',
    'mustard',
    'sesame',
    'sulphites',
    'lupin',
    'molluscs',
  ];

  // Live demo-tenant data, 2026-07-25: these four were ALL falling through.
  it.each(['gluten', 'milk', 'nuts', 'sesame'])('warns for %s, which the demo menu actually uses', (allergen) => {
    expect(getAllergenInfo(allergen)).toEqual({ kind: 'substance', canonical: allergen });
  });

  it('covers the whole EU-14 list, so no real menu falls through', () => {
    expect(EU14.filter((a) => getAllergenInfo(a).kind !== 'substance')).toEqual([]);
  });

  /**
   * The demo-tenant regression, restated for a uniform glyph.
   *
   * The original assertion was `new Set(icons).size === 4` — four allergens, four emoji. Under D9
   * every substance shares one glyph, so counting glyphs would pass with all four unrecognised,
   * which is precisely the bug.
   *
   * Counting CANONICALS does not fix that, and the first draft of this test did exactly that and
   * was vacuous: `canonical` falls back to the normalised input (`ALLERGEN_ALIASES[bare] ?? bare`),
   * so four different input words yield four different canonicals unconditionally — deleting the
   * whole EU-14 branch left it green. The `kind` is the half that can regress, so both are asserted
   * together, as whole objects.
   */
  it('resolves the four demo allergens to four RECOGNISED substances, not one unknown bucket', () => {
    expect(['gluten', 'milk', 'nuts', 'sesame'].map(getAllergenInfo)).toEqual([
      { kind: 'substance', canonical: 'gluten' },
      { kind: 'substance', canonical: 'milk' },
      { kind: 'substance', canonical: 'nuts' },
      { kind: 'substance', canonical: 'sesame' },
    ]);
  });

  it('gives all 14 substances distinct entries, every one recognised', () => {
    const resolved = EU14.map(getAllergenInfo);
    expect(new Set(resolved.map((r) => r.canonical)).size).toBe(EU14.length);
    expect(resolved.filter((r) => r.kind !== 'substance')).toEqual([]);
  });
});

describe('getAllergenInfo — spelling tolerance', () => {
  it('treats `contains_x` as the same substance as `x`', () => {
    expect(getAllergenInfo('contains_gluten')).toEqual(getAllergenInfo('gluten'));
    expect(getAllergenInfo('contains_nuts')).toEqual(getAllergenInfo('nuts'));
  });

  it.each([
    ['dairy', 'milk'],
    ['lactose', 'milk'],
    ['wheat', 'gluten'],
    ['soya', 'soy'],
    ['egg', 'eggs'],
    ['peanut', 'peanuts'],
    ['shellfish', 'crustaceans'],
    ['sulfites', 'sulphites'],
    ['tree nuts', 'nuts'],
  ])('maps the %s spelling onto %s', (written, canonical) => {
    expect(getAllergenInfo(written)).toEqual({ kind: 'substance', canonical });
  });

  it('normalises case, spaces and hyphens', () => {
    expect(getAllergenInfo('  Gluten-Free ')).toEqual(getAllergenInfo('gluten_free'));
    expect(getAllergenInfo('Contains Nuts')).toEqual(getAllergenInfo('contains_nuts'));
  });

  it('still warns for a "contains" of something off the list', () => {
    expect(getAllergenInfo('contains_unicorn')).toEqual({ kind: 'substance', canonical: 'unicorn' });
    // The prefix regex does not know this spelling, so the substring check is the
    // only thing keeping it a warning rather than an unknown.
    expect(getAllergenInfo('may_contain_traces_of_unicorn').kind).toBe('substance');
  });

  it('falls back only for a genuinely unknown token', () => {
    expect(getAllergenInfo('artisanal_vibes')).toEqual({ kind: 'unknown', canonical: 'artisanal_vibes' });
  });
});
