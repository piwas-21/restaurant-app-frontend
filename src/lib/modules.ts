/**
 * Product-module vocabulary and the route → module map (sofra ADR-010 / S11,
 * workspace SOFRA-ONBOARDING-PLAN O5).
 *
 * The tenant's instance runs only the modules they bought. The backend gates the
 * endpoints; this file is what lets the UI stop offering a surface whose API would
 * 404 underneath it.
 *
 * These exact ids also live in backend `Common/Modules/ModuleIds.cs`, sofra
 * `lib/module-catalog.ts` and the deploy repo's `provision-tenant.sh` — all four must
 * agree or a tenant's registry entry stops meaning what it says.
 */

export const MODULE_IDS = [
  'core',
  'kitchen-board',
  'cashier',
  'server',
  'reservations',
  'loyalty',
  'printing',
  'extra-languages',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}

/**
 * Routes owned by a module, longest-prefix wins. A path that matches nothing here is
 * unrestricted — core, or a surface no module owns.
 *
 * Kept to the surfaces the BACKEND also gates, so the UI and the API agree about what
 * exists. Deliberately absent, mirroring the backend: `/admin/table-layout-editor` and
 * `/admin/table-statistics`. The table map is shared — reservations needs it as much as
 * `server` does — so gating it on either module would break the other.
 *
 * `printing` has no entry because it has no page: the backend gates it on the device and
 * printer-feed APIs the printer-app calls. Add `/admin/devices` here the day such a page
 * ships, or it goes out ungated.
 */
const ROUTE_MODULE_ENTRIES: ReadonlyArray<readonly [string, ModuleId]> = [
  ['/reservations', 'reservations'],
  ['/my-reservations', 'reservations'],
  ['/admin/reservations-management', 'reservations'],
  ['/kitchen-staff', 'kitchen-board'],
  ['/cashier', 'cashier'],
  ['/server', 'server'],
  ['/admin/point-rules', 'loyalty'],
  ['/admin/customer-discounts', 'loyalty'],
  ['/admin/fidelity-analytics', 'loyalty'],
  ['/admin/user-groups', 'loyalty'],
];

// Longest prefix first, resolved once at module load, so `moduleForPath` can return the
// FIRST match and still be longest-wins. Structural rather than conditional on purpose:
// no two entries overlap today, so a "keep the longer one" comparison inside the lookup
// would be a branch nothing can exercise — dead code pretending to be a safeguard. Add an
// overlapping pair above and the guarantee still holds, with no change here.
const ROUTE_MODULES = [...ROUTE_MODULE_ENTRIES].sort((a, b) => b[0].length - a[0].length);

/**
 * The module owning `pathname`, or null when no module does.
 *
 * Matches on a path SEGMENT boundary, so `/servers-guide` is not read as `/server` and
 * `/reservationsomething` is not read as `/reservations`. Longest prefix wins, by the
 * table's sort order.
 */
export function moduleForPath(pathname: string): ModuleId | null {
  const match = ROUTE_MODULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}
