import { localizedTenantHref, tenantLocaleHref } from './tenantLocaleNavigation';

describe('tenant locale navigation', () => {
  it('keeps known private destinations inside the active locale', () => {
    expect(tenantLocaleHref('/ar/checkout/review', '/cart')).toBe('/ar/cart');
    expect(tenantLocaleHref('/fr/admin/menu-management', '/admin/option-sets/new?type=menu')).toBe(
      '/fr/admin/option-sets/new?type=menu',
    );
  });

  it('replaces an existing route locale and preserves full return state', () => {
    expect(localizedTenantHref('de', '/ar/checkout/confirmation?orderId=42&sessionId=s#t=secret')).toBe(
      '/de/checkout/confirmation?orderId=42&sessionId=s#t=secret',
    );
  });

  it('leaves an already localized target untouched when rendering a language alternative', () => {
    expect(tenantLocaleHref('/ar/menu', '/en/cart?tableId=7')).toBe('/en/cart?tableId=7');
  });

  it('retains only safe QR/table context when a locale route changes app destinations', () => {
    const context = new URLSearchParams('qr=printed&tableId=7&orderId=private');
    expect(tenantLocaleHref('/ar/menu', '/cart', context)).toBe('/ar/cart?qr=printed&tableId=7');
    expect(tenantLocaleHref('/ar/cart', '/ar/checkout/review?orderId=42', context)).toBe(
      '/ar/checkout/review?orderId=42&qr=printed&tableId=7',
    );
  });

  it('does not localize external, API, asset, or unknown destinations', () => {
    expect(tenantLocaleHref('/fr/cart', 'https://payments.example/return')).toBe('https://payments.example/return');
    expect(tenantLocaleHref('/fr/cart', '/api/checkout')).toBe('/api/checkout');
    expect(tenantLocaleHref('/fr/cart', '/unknown/path')).toBe('/unknown/path');
  });
});
