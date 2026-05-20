import type { Page } from '@playwright/test';

/**
 * Test-side mirror of the runtime `AnalyticsEventName` union in
 * src/lib/analytics.ts. Kept narrow on purpose — tests assert against a
 * fixed funnel so adding a new event here is a deliberate decision, not
 * a silent contract change.
 */
export type CapturedAnalyticsName =
  | 'order_type_selected'
  | 'checkout_opened'
  | 'checkout_completed';

export interface CapturedAnalyticsEvent {
  event: CapturedAnalyticsName;
  ts: number;
  orderType?: string;
  source?: string;
  loggedIn?: boolean;
  itemCount?: number;
  orderId?: string;
  orderNumber?: string;
}

/**
 * Attach a global capture array on `window` that subscribes to the
 * `rumi:analytics` CustomEvent fired by src/lib/analytics.ts. Must be
 * called before the action that triggers events — usually right after
 * `page.goto(...)`, inside an `addInitScript` if events fire pre-load
 * (none of the C1.5 events do, so post-navigation is fine).
 *
 * Returns a reader that snapshots the current capture array on demand.
 * The reader is async because it reaches into the page via evaluate,
 * not because we await anything ourselves.
 */
export async function captureAnalytics(page: Page) {
  await page.evaluate(() => {
    interface AnalyticsWindow extends Window {
      __rumiAnalytics?: unknown[];
    }
    const w = window as AnalyticsWindow;
    w.__rumiAnalytics = [];
    window.addEventListener('rumi:analytics', (e) => {
      w.__rumiAnalytics?.push((e as CustomEvent).detail);
    });
  });

  return {
    snapshot: () =>
      page.evaluate<CapturedAnalyticsEvent[]>(() => {
        interface AnalyticsWindow extends Window {
          __rumiAnalytics?: CapturedAnalyticsEvent[];
        }
        return [...((window as AnalyticsWindow).__rumiAnalytics ?? [])];
      }),
  };
}
