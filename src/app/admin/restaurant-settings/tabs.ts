/**
 * The `?tab=` vocabulary for `/admin/restaurant-settings`.
 *
 * A leaf module rather than an export from `page.tsx`, so other code — and the tests
 * that pin the first-run checklist's deep links to it (`lib/setupSteps.test.ts`) — can
 * read the ids without importing the page and, with it, every tab component and the
 * Next server runtime behind them.
 */
export const TAB_IDS = ['hours', 'order-types', 'tax', 'general', 'appearance'] as const;

export type TabType = (typeof TAB_IDS)[number];

export const isTabId = (value: string | null): value is TabType => !!value && TAB_IDS.includes(value as TabType);
