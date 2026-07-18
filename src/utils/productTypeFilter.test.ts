import fs from 'fs';
import path from 'path';
import {
  MENU_BUNDLE_TYPE,
  MENU_TYPE_FILTERS,
  MENU_TYPE_FILTER_LABEL_KEYS,
  isMenuBundle,
  toProductTypeQuery,
} from './productTypeFilter';

describe('toProductTypeQuery', () => {
  it('asks for a mixed list on "all"', () => {
    // Requires backend #189's IncludeMenus — an unfiltered query hides bundles.
    expect(toProductTypeQuery('all')).toEqual({ includeMenus: true });
  });

  it('sends nothing on "items" — the backend already excludes bundles by default', () => {
    expect(toProductTypeQuery('items')).toEqual({});
  });

  it('sends the enum NAME on "bundles"', () => {
    // Query-string enum binding is by name ('Menu'), while responses carry the
    // [EnumMember] value ('menu'). Sending 'menu' here would be a different contract.
    expect(toProductTypeQuery('bundles')).toEqual({ type: 'Menu' });
  });

  it('never sets both type and includeMenus — the backend ignores the latter when Type is set', () => {
    for (const filter of MENU_TYPE_FILTERS) {
      const query = toProductTypeQuery(filter);
      expect(query.type && query.includeMenus).toBeFalsy();
    }
  });
});

describe('isMenuBundle', () => {
  it('identifies a bundle by its wire type', () => {
    expect(isMenuBundle({ type: MENU_BUNDLE_TYPE })).toBe(true);
    expect(isMenuBundle({ type: 'menu' })).toBe(true);
  });

  it('treats every other product type as a plain item', () => {
    // The values the backend actually serializes (ProductType [EnumMember]s).
    for (const type of ['mainItem', 'beverage', 'dessert', 'sideItem', 'sauce']) {
      expect(isMenuBundle({ type })).toBe(false);
    }
  });

  it('is not fooled by casing — the wire value is camelCase, not the enum name', () => {
    // Guards the mirror-image of the query-param rule: 'Menu' is what we SEND,
    // 'menu' is what we RECEIVE. A row typed 'Menu' would mean the contract moved.
    expect(isMenuBundle({ type: 'Menu' })).toBe(false);
  });

  it('does not throw on a missing row or a row without a type', () => {
    // `products.find(...)` returns undefined when the list has moved on (e.g. a
    // delete confirmed after a refetch), and the delete path must not crash there.
    expect(isMenuBundle(undefined)).toBe(false);
    expect(isMenuBundle(null)).toBe(false);
    expect(isMenuBundle({})).toBe(false);
    expect(isMenuBundle({ type: undefined })).toBe(false);
  });
});

describe('chip labels', () => {
  it('has a label key for every filter', () => {
    for (const filter of MENU_TYPE_FILTERS) {
      expect(MENU_TYPE_FILTER_LABEL_KEYS[filter]).toBeTruthy();
    }
  });

  it('resolves every label key in every locale', () => {
    // t('key') silently renders the literal key when it is missing from a locale —
    // exactly how `customize` and `special` shipped to prod (#205/#206). Read the
    // locale files that actually ship, so a missing key fails here and not in prod.
    const locales = ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh'];
    for (const locale of locales) {
      const file = path.join(__dirname, '..', 'locales', `${locale}.json`);
      const messages = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      for (const filter of MENU_TYPE_FILTERS) {
        const key = MENU_TYPE_FILTER_LABEL_KEYS[filter];
        expect(`${locale}:${key}=${typeof messages[key]}`).toBe(`${locale}:${key}=string`);
        expect(messages[key]).not.toBe('');
      }
    }
  });
});
