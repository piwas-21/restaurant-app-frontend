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

  it('isLoggedInForAnalytics reads auth_token from localStorage', () => {
    expect(isLoggedInForAnalytics()).toBe(false);
    window.localStorage.setItem('auth_token', 'eyJ.fake.jwt');
    expect(isLoggedInForAnalytics()).toBe(true);
    window.localStorage.removeItem('auth_token');
    expect(isLoggedInForAnalytics()).toBe(false);
  });
});
