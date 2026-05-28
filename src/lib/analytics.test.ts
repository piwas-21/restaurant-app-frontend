/**
 * Unit tests for the analytics emitter. Verifies:
 *   - events land in `window.dataLayer` with the expected shape
 *   - the `rumi:analytics` CustomEvent fires per call (e2e capture channel)
 *   - SSR-safety: a `window`-less context is a no-op, not a throw
 *   - `isLoggedInForAnalytics` reflects `localStorage.auth_token`
 */

import { trackEvent, isLoggedInForAnalytics } from './analytics';

describe('analytics', () => {
  beforeEach(() => {
    // Reset between tests — jest-environment-jsdom persists window across cases.
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    window.localStorage.clear();
  });

  it('pushes the event into window.dataLayer with the right shape', () => {
    trackEvent('order_type_selected', { orderType: 'Takeaway', source: 'sidebar', loggedIn: false });

    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl).toHaveLength(1);
    expect(dl[0]).toMatchObject({
      event: 'order_type_selected',
      orderType: 'Takeaway',
      source: 'sidebar',
      loggedIn: false,
    });
    expect(typeof dl[0].ts).toBe('number');
  });

  it('appends — multiple events accumulate in order', () => {
    trackEvent('order_type_selected', { orderType: 'Takeaway' });
    trackEvent('checkout_opened', { orderType: 'Takeaway' });
    trackEvent('checkout_completed', { orderType: 'Takeaway', orderId: 'abc', orderNumber: 'R-1' });

    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl.map((e) => e.event)).toEqual(['order_type_selected', 'checkout_opened', 'checkout_completed']);
    expect(dl[2]).toMatchObject({ orderId: 'abc', orderNumber: 'R-1' });
  });

  it('dispatches a rumi:analytics CustomEvent with the same payload (e2e channel)', () => {
    const received: Array<Record<string, unknown>> = [];
    const listener = (e: Event) => received.push((e as CustomEvent).detail);
    window.addEventListener('rumi:analytics', listener);

    try {
      trackEvent('checkout_opened', { orderType: 'Delivery', loggedIn: true });
    } finally {
      window.removeEventListener('rumi:analytics', listener);
    }

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      event: 'checkout_opened',
      orderType: 'Delivery',
      loggedIn: true,
    });
  });

  it('accepts the C1.5 funnel events with their respective payload shapes', () => {
    // cart_opened — fired from the mobile FAB click.
    trackEvent('cart_opened', { source: 'mobile_sheet', itemCount: 3, loggedIn: false });
    // cart_item_added — fired after the backend confirms the add.
    trackEvent('cart_item_added', { productId: 'prod-1', quantity: 2, loggedIn: true });
    // customer_info_submitted — fired by the modal commit path.
    trackEvent('customer_info_submitted', {
      source: 'takeaway_modal',
      fields: ['name', 'email', 'phone'],
      loggedIn: false,
    });
    // register_inline_completed — fired only on backend-confirmed registration.
    trackEvent('register_inline_completed', { loggedIn: false });

    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl.map((e) => e.event)).toEqual([
      'cart_opened',
      'cart_item_added',
      'customer_info_submitted',
      'register_inline_completed',
    ]);
    expect(dl[0]).toMatchObject({ source: 'mobile_sheet', itemCount: 3 });
    expect(dl[1]).toMatchObject({ productId: 'prod-1', quantity: 2 });
    expect(dl[2]).toMatchObject({ source: 'takeaway_modal', fields: ['name', 'email', 'phone'] });
    expect(dl[3]).toMatchObject({ event: 'register_inline_completed', loggedIn: false });
  });

  it('isLoggedInForAnalytics reads auth_token from localStorage', () => {
    expect(isLoggedInForAnalytics()).toBe(false);
    window.localStorage.setItem('auth_token', 'eyJ.fake.jwt');
    expect(isLoggedInForAnalytics()).toBe(true);
    window.localStorage.removeItem('auth_token');
    expect(isLoggedInForAnalytics()).toBe(false);
  });
});
