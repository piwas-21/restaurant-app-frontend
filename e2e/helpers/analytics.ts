import type { Page } from '@playwright/test';

/**
 * Test-side mirror of the runtime `AnalyticsEventName` union in
 * src/lib/analytics.ts. Kept narrow on purpose — tests assert against a
 * fixed funnel so adding a new event here is a deliberate decision, not
 * a silent contract change.
 */
export type CapturedAnalyticsName = 'order_type_selected' | 'checkout_opened' | 'checkout_completed';

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
 * `rumi:analytics` CustomEvent fired by src/lib/analytics.ts.
 *
 * **Must be called BEFORE `page.goto(...)`.** The listener is registered
 * via `page.addInitScript`, so it runs on every navigation before any
 * application JS executes. This guarantees the listener is attached
 * regardless of which surface the test first interacts with — a future
 * test that fires events before the sidebar is visible (or before any
 * specific element renders) still captures everything.
 *
 * Returns a reader that snapshots the current capture array on demand.
 * The reader is async because it reaches into the page via evaluate,
 * not because we await anything ourselves.
 */
export async function captureAnalytics(page: Page) {
  await page.addInitScript(() => {
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
