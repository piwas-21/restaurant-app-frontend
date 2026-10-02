/** @jest-environment node */

import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function request(path: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(new URL(path, 'https://tenant.test'), { headers });
}

describe('tenant locale middleware', () => {
  it('negotiates a bare menu URL from weighted device language and keeps only safe QR context', () => {
    const response = middleware(
      request('/menu?qr=printed&tableId=7&token=secret', { 'accept-language': 'en-US,fr;q=0.8' }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://tenant.test/en/menu?qr=printed&tableId=7');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('vary')).toBe('Accept-Language, Cookie');
  });

  it('uses the explicit preference cookie ahead of browser language for private legacy URLs', () => {
    const response = middleware(
      request('/checkout/review?orderId=42&sessionId=s', {
        cookie: 'tenant_locale_v1=ar; i18nextLng=fr',
        'accept-language': 'fr-CH, en;q=0.9',
      }),
    );

    expect(response.headers.get('location')).toBe('https://tenant.test/ar/checkout/review?orderId=42&sessionId=s');
  });

  it('localizes known cashier and legacy order routes while preserving query state', () => {
    expect(middleware(request('/cashier?order=7', { 'accept-language': 'de' })).headers.get('location')).toBe(
      'https://tenant.test/de/cashier/orders?order=7',
    );
    expect(middleware(request('/my-orders?orderId=8', { 'accept-language': 'fr' })).headers.get('location')).toBe(
      'https://tenant.test/fr/orders?orderId=8',
    );
  });

  it('localizes the unprefixed delivery-channel callback and preserves its opaque flow id', () => {
    const response = middleware(
      request('/admin/delivery-channels/callback?flowId=flow-opaque-42', { 'accept-language': 'fr-CH, en;q=0.8' }),
    );

    expect(response.headers.get('location')).toBe(
      'https://tenant.test/fr/admin/delivery-channels/callback?flowId=flow-opaque-42',
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('keeps explicit route locale deterministic and replaces spoofed internal locale headers', () => {
    const response = middleware(
      request('/ar/cart', {
        'x-tenant-route-locale': 'fr',
        'x-tenant-public-locale': 'en',
        'accept-language': 'de',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-request-x-tenant-route-locale')).toBe('ar');
    expect(response.headers.get('x-middleware-request-x-tenant-public-locale')).toBeNull();
  });

  it('strips internal hints from API requests and leaves unknown paths unlocalized', () => {
    const apiResponse = middleware(request('/api/health', { 'x-tenant-route-locale': 'ar' }));
    const unknownResponse = middleware(request('/not-a-tenant-route', { 'accept-language': 'fr' }));

    expect(apiResponse.headers.get('x-middleware-request-x-tenant-route-locale')).toBeNull();
    expect(unknownResponse.status).toBe(200);
    expect(unknownResponse.headers.get('location')).toBeNull();
  });
});
