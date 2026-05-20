/**
 * Lightweight analytics emitter for the order-flow funnel.
 *
 * Context — BUGS-IMPROVEMENTS-PLAN §C1.9: the C1.5 decomposition deleted the
 * dedicated /cart and /checkout/customer-info pages, which broke any
 * page-view-based funnel tracking. This module re-instruments the funnel as
 * explicit events fired by the new components (sidebar / FAB / type modals).
 *
 * Deliberately dependency-free — no GA, GTM, posthog or segment SDK pulled in
 * here. We:
 *   1. Push the event into `window.dataLayer` (GTM-compatible if/when a
 *      tag-manager loader is added by ops; no-op until then).
 *   2. Dispatch a `CustomEvent('rumi:analytics', { detail })` on `window` so
 *      Playwright / dev-tools observers can subscribe without scraping
 *      network calls. The e2e suite uses this to assert events fire.
 *
 * Naming convention: `snake_case`, verb-led, scoped where helpful
 * (e.g. `checkout_opened`, `order_type_selected`). The two seed events
 * called out by the plan — `checkout_opened` + `checkout_completed` —
 * are the canonical funnel anchors; everything else expands the funnel.
 *
 * SSR-safe: every call is a no-op when `window` is undefined.
 */

export type AnalyticsEventName =
  | 'order_type_selected'
  | 'checkout_opened'
  | 'checkout_completed';

export interface AnalyticsEventPayload {
  /** Order type when known (DineIn | Takeaway | Delivery). */
  orderType?: string;
  /** Source surface — 'sidebar' | 'mobile_sheet' | 'welcome_modal' | 'review'. */
  source?: string;
  /** Whether the actor is logged in (vs guest) at the time of the event. */
  loggedIn?: boolean;
  /** Number of distinct items in the cart at event time (sum-of-quantities). */
  itemCount?: number;
  /** Order id returned by POST /api/Orders — set on checkout_completed only. */
  orderId?: string;
  /** Human-readable order number from backend — set on checkout_completed only. */
  orderNumber?: string;
}

interface DataLayerEntry extends AnalyticsEventPayload {
  event: AnalyticsEventName;
  ts: number;
}

declare global {
  interface Window {
    dataLayer?: DataLayerEntry[];
  }
}

/**
 * Fire an analytics event. Safe to call from any client component / hook.
 *
 * IMPORTANT: must be called from the user-action handler, not from an effect
 * that watches state — re-renders would fire the event multiple times. The
 * existing call sites (OrderFlowModals, useSmartCheckoutRouter,
 * /checkout/review handlePlaceOrder) all live on the action path.
 */
export function trackEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}): void {
  if (typeof window === 'undefined') return;

  const entry: DataLayerEntry = { event: name, ts: Date.now(), ...payload };

  // GTM-compatible queue. Initialised here rather than in a separate loader
  // so we never silently drop the first events on a cold page.
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(entry);

  // Test/inspector channel. Playwright subscribes to this via
  // page.evaluate(() => new Promise(r => window.addEventListener('rumi:analytics', r, { once: true }))).
  try {
    window.dispatchEvent(new CustomEvent('rumi:analytics', { detail: entry }));
  } catch {
    // Older browsers without CustomEvent — funnel still recorded in dataLayer.
  }
}

/** Convenience helper — read auth state the same way the rest of the app does. */
export function isLoggedInForAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem('auth_token');
}
