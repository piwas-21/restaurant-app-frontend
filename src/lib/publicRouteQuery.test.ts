import {
  isHomeRoutePathname,
  publicHomeHref,
  publicLocaleHref,
  publicMenuPageHref,
  publicMenuQuery,
  publicRouteLocation,
  searchParamsToURLSearchParams,
} from './publicRouteQuery';

describe('searchParamsToURLSearchParams', () => {
  it('preserves repeated values and omits undefined entries', () => {
    expect(searchParamsToURLSearchParams({ tag: ['first', 'second'], page: '2', omitted: undefined }).toString()).toBe(
      'tag=first&tag=second&page=2',
    );
  });
});

describe('publicLocaleHref', () => {
  it('preserves QR/table/PWA context and valid product pagination on menu links', () => {
    const href = publicLocaleHref(
      'en',
      'menu',
      new URLSearchParams('qr=table_1_token&tableId=table-1&pwa=off&page=2&unknown=x'),
    );
    expect(href).toBe('/en/menu?qr=table_1_token&tableId=table-1&pwa=off&page=2');
  });

  it('keeps table context on home links but drops menu-only pagination', () => {
    const href = publicLocaleHref('fr', 'home', new URLSearchParams('table=5&bundlesPage=3&view=bundles'));
    expect(href).toBe('/fr?table=5');
  });

  it('normalizes bundle pagination as a bundle view and drops conflicting product pagination', () => {
    const href = publicLocaleHref('nl', 'menu', new URLSearchParams('page=7&bundlesPage=2&unknown=x'));
    expect(href).toBe('/nl/menu?view=bundles&bundlesPage=2');
  });

  it('preserves a safe category filter across locale and product-page links, and clears it on All', () => {
    const current = new URLSearchParams('categoryId=category-7&page=2&qr=table-token');
    expect(publicLocaleHref('en', 'menu', current)).toBe('/en/menu?qr=table-token&page=2&categoryId=category-7');
    expect(publicMenuPageHref('fr', current, 'products', 3)).toBe(
      '/fr/menu?qr=table-token&page=3&categoryId=category-7',
    );
    expect(publicMenuQuery(current, 'products', 1, null).toString()).toBe('qr=table-token');
  });

  it('keeps the route parser first-value policy and canonicalizes repeated category IDs', () => {
    const duplicate = new URLSearchParams('categoryId=cat-tacos&categoryId=cat-drinks&page=3');
    expect(publicMenuQuery(duplicate, 'products', 3).toString()).toBe('page=3&categoryId=cat-tacos');
  });

  it('drops malformed page values and unknown parameters', () => {
    expect(publicLocaleHref('ar', 'menu', new URLSearchParams('page=0&token=private'))).toBe('/ar/menu');
  });
});

describe('publicRouteLocation', () => {
  it('recognizes only locale-prefixed public home and menu routes', () => {
    expect(publicRouteLocation('/fr')).toEqual({ locale: 'fr', surface: 'home' });
    expect(publicRouteLocation('/ar/menu')).toEqual({ locale: 'ar', surface: 'menu' });
    expect(publicRouteLocation('/fr/cart')).toBeNull();
    expect(publicRouteLocation('/cart')).toBeNull();
  });

  it('keeps the current locale and safe table context on the header home link', () => {
    expect(publicHomeHref('/fr/menu', new URLSearchParams('tableId=table-7&page=3&token=secret'))).toBe(
      '/fr?tableId=table-7',
    );
    expect(isHomeRoutePathname('/fr')).toBe(true);
    expect(isHomeRoutePathname('/fr/menu')).toBe(false);
  });
});
