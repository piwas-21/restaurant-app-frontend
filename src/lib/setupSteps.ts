/**
 * Where each first-run setup step sends the owner (SOFRA-ONBOARDING-PLAN O4).
 *
 * The backend owns the step VOCABULARY, their order, their done-state and the
 * module filtering (`Features/Setup/SetupSteps.cs`). This file owns only the
 * presentation half it cannot know: which route in this app each step means. Adding a
 * step is therefore a two-repo change, and an unmapped key renders as guidance with no
 * link rather than a link to nowhere.
 */

import type { ModuleId } from '@/lib/modules';

/** Step keys, mirroring `SetupSteps.cs`. */
export const SETUP_STEP_KEYS = [
  'restaurant-info',
  'opening-hours',
  'appearance',
  'logo',
  'menu',
  'tables-qr',
  'staff',
  'kitchen-board',
  'cashier',
  'server',
  'reservations',
  'loyalty',
  'printing',
] as const;

export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number];

/**
 * The route a step takes the owner to, or null when it has none.
 *
 * `printing` is deliberately null: the printer app is a desktop/Android binary, not a
 * page in this app, so the step is instructions rather than a link. A step mapped to a
 * route that does not exist would be worse than one with no link at all.
 */
const STEP_ROUTES: Readonly<Record<string, string | null>> = {
  'restaurant-info': '/admin/restaurant-settings?tab=general',
  'opening-hours': '/admin/restaurant-settings?tab=hours',
  appearance: '/admin/restaurant-settings?tab=appearance',
  logo: '/admin/restaurant-settings?tab=logo',
  menu: '/admin/menu-management',
  'tables-qr': '/admin/table-layout-editor',
  staff: '/admin/member-management',
  'kitchen-board': '/kitchen-staff',
  cashier: '/cashier',
  server: '/server',
  reservations: '/admin/reservations-management',
  loyalty: '/admin/point-rules',
  printing: null,
};

/** Where `key` sends the owner, or null when the step is guidance only. */
export function setupStepHref(key: string): string | null {
  return STEP_ROUTES[key] ?? null;
}

/**
 * The pathname part of a step's route, for module gating.
 *
 * `moduleForPath` matches on segment boundaries and would not recognise a path still
 * carrying `?tab=general`, so the query is stripped before the lookup — silently
 * treating a gated route as ungated is exactly the failure this check exists to catch.
 */
export function setupStepPathname(key: string): string | null {
  const href = setupStepHref(key);
  return href ? href.split('?')[0] : null;
}

/**
 * Whether this step belongs on this instance's checklist.
 *
 * The backend already filters the list by module, so in a correct system this never
 * removes anything. It runs anyway because a checklist row IS a link to a route:
 * offering one whose route the guard would block is the same defect as leaving a nav
 * entry behind a hidden page, and the owner meets it as a dead end on the very first
 * thing the product asked them to do.
 *
 * Two independent checks, because neither covers the other:
 *
 *  - the step's OWN `moduleId`, which the payload carries and which is authoritative.
 *    Checking only the route would leave a route-less step (`printing`) ungated no
 *    matter what module owns it.
 *  - the module owning its destination route, via the SAME map `ModuleRouteGuard` and
 *    the admin sidebar use. Checking only `moduleId` would miss a step whose own module
 *    is enabled while its destination happens to sit behind a different one.
 */
export function isSetupStepReachable(
  step: { key: string; moduleId?: string | null },
  moduleForPath: (pathname: string) => ModuleId | null,
  isModuleEnabled: (moduleId: ModuleId | null) => boolean,
): boolean {
  if (!isModuleEnabled((step.moduleId ?? null) as ModuleId | null)) return false;
  const pathname = setupStepPathname(step.key);
  return pathname === null || isModuleEnabled(moduleForPath(pathname));
}
