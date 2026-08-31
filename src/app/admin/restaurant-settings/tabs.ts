/**
 * The `?tab=` vocabulary for `/admin/restaurant-settings`.
 *
 * A leaf module rather than an export from `page.tsx`, so other code — and the tests
 * that pin the first-run checklist's deep links to it (`lib/setupSteps.test.ts`) — can
 * read the ids without importing the page and, with it, every tab component and the
 * Next server runtime behind them.
 */

import type { ModuleId } from '@/lib/modules';

export const TAB_IDS = ['hours', 'order-types', 'tax', 'general', 'appearance', 'logo', 'landing', 'payments'] as const;

export type TabType = (typeof TAB_IDS)[number];

/**
 * The module a tab belongs to, when one owns it. Absent = every tenant gets it.
 *
 * `payments` is the first tab that is not universal, and it needs its own map because
 * `/admin/restaurant-settings` is itself ungated: the page is core, so `ROUTE_MODULE_ENTRIES`
 * cannot express "this one strip of it is not". Without this a tenant who never bought
 * `online-payments` would be offered a tab whose only endpoint answers them 404 — the same
 * "nav entry in front of a hidden page" defect the route guard exists to prevent, one level down.
 */
export const TAB_MODULE: Partial<Readonly<Record<TabType, ModuleId>>> = {
  payments: 'online-payments',
};

export const isTabId = (value: string | null): value is TabType => !!value && TAB_IDS.includes(value as TabType);

/**
 * Whether this instance offers `id` at all.
 *
 * A function here rather than an inline check on the page, so it is reachable by a test:
 * the page is a client component behind a Suspense boundary and `useSearchParams`, and a
 * gate that can only be exercised by rendering all seven tabs is a gate nobody exercises.
 */
export const isTabAvailable = (id: TabType, modules: ReadonlySet<ModuleId>): boolean => {
  const owner = TAB_MODULE[id];
  return !owner || modules.has(owner);
};
