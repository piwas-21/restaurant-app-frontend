import { getAllergenInfo, AVAILABLE_ALLERGENS } from '@/lib/allergens';

/**
 * The icon table is shared by both templates, so a miss shows up as the generic
 * 🏷️ label on every menu card. That is what it was doing for the demo tenant:
 * its four distinct allergens are bare EU-14 substance names, none of which the
 * table held.
 */
const FALLBACK = '🏷️';

describe('getAllergenInfo — dietary claims (the admin form vocabulary)', () => {
  it.each(AVAILABLE_ALLERGENS)('recognises %s, the values the product editor offers', (allergen) => {
    expect(getAllergenInfo(allergen).icon).not.toBe(FALLBACK);
  });

  it('keeps a _free claim distinct from the substance it excludes', () => {
    expect(getAllergenInfo('gluten_free').className).toBe('glutenFree');
    expect(getAllergenInfo('gluten').className).toBe('warning');
    expect(getAllergenInfo('gluten_free').icon).not.toBe(getAllergenInfo('gluten').icon);
  });
});

describe('getAllergenInfo — bare substance names (how menus are actually written)', () => {
  // Live demo-tenant data, 2026-07-25: these four were ALL rendering the fallback.
  it.each(['gluten', 'milk', 'nuts', 'sesame'])('recognises %s, which the demo menu actually uses', (allergen) => {
    const { icon, className } = getAllergenInfo(allergen);
    expect(icon).not.toBe(FALLBACK);
    expect(className).toBe('warning');
  });

  it('covers the whole EU-14 list, so no real menu falls back', () => {
    const eu14 = [
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
    expect(eu14.filter((a) => getAllergenInfo(a).icon === FALLBACK)).toEqual([]);
  });

  it('gives the four demo allergens FOUR different icons, not one repeated glyph', () => {
    const icons = ['gluten', 'milk', 'nuts', 'sesame'].map((a) => getAllergenInfo(a).icon);
    expect(new Set(icons).size).toBe(4);
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
    expect(getAllergenInfo(written)).toEqual(getAllergenInfo(canonical));
  });

  it('normalises case, spaces and hyphens', () => {
    expect(getAllergenInfo('  Gluten-Free ')).toEqual(getAllergenInfo('gluten_free'));
    expect(getAllergenInfo('Contains Nuts')).toEqual(getAllergenInfo('contains_nuts'));
  });

  it('still warns for a "contains" of something off the list', () => {
    expect(getAllergenInfo('contains_unicorn')).toEqual({ icon: '⚠️', className: 'warning' });
  });

  it('falls back only for a genuinely unknown token', () => {
    expect(getAllergenInfo('artisanal_vibes').icon).toBe(FALLBACK);
  });
});
