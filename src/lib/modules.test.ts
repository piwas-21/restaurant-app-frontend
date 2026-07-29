import { MODULE_IDS, isModuleId, moduleForPath } from './modules';

describe('module vocabulary', () => {
  it('matches the catalog at the other end of the seam', () => {
    // The same ids live in backend Common/Modules/ModuleIds.cs, sofra lib/module-catalog.ts
    // and deploy provision-tenant.sh. Drift silently changes what a registry entry means.
    expect([...MODULE_IDS]).toEqual([
      'core',
      'kitchen-board',
      'cashier',
      'server',
      'reservations',
      'loyalty',
      'printing',
      'extra-languages',
    ]);
  });

  it('rejects an unrecognised id', () => {
    expect(isModuleId('reservations')).toBe(true);
    expect(isModuleId('reservatons')).toBe(false);
    expect(isModuleId('')).toBe(false);
  });
});

describe('moduleForPath', () => {
  it.each([
    ['/reservations', 'reservations'],
    ['/reservations/new', 'reservations'],
    ['/my-reservations', 'reservations'],
    ['/admin/reservations-management', 'reservations'],
    ['/kitchen-staff', 'kitchen-board'],
    ['/cashier', 'cashier'],
    ['/server', 'server'],
    ['/admin/point-rules', 'loyalty'],
    ['/admin/customer-discounts', 'loyalty'],
    ['/admin/fidelity-analytics', 'loyalty'],
    ['/admin/user-groups', 'loyalty'],
    ['/admin/user-groups/42', 'loyalty'],
  ])('maps %s to %s', (path, moduleId) => {
    expect(moduleForPath(path)).toBe(moduleId);
  });

  it.each([
    '/',
    '/menu',
    '/cart',
    '/checkout/review',
    '/admin/dashboard',
    '/admin/menu-management',
    // Shared with core surfaces on the backend too — gating the table map on `server`
    // would break every reservations tenant, so neither end gates it.
    '/admin/table-layout-editor',
    '/admin/table-statistics',
  ])('leaves %s unrestricted', (path) => {
    expect(moduleForPath(path)).toBeNull();
  });

  it.each([
    // A prefix must not swallow a longer, unrelated route name.
    '/servers-guide',
    '/reservationsomething',
    '/cashiers',
  ])('does not claim %s on a partial segment match', (path) => {
    expect(moduleForPath(path)).toBeNull();
  });

  it('is safe on an empty path', () => {
    expect(moduleForPath('')).toBeNull();
  });
});
