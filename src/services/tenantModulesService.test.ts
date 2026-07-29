import { MODULE_IDS } from '@/lib/modules';

/**
 * tenantModulesService FAILS OPEN in every failure mode — that is the whole contract.
 *
 * The live RUMI install has no module list and its backend reports the full set; an older
 * backend has no such endpoint at all and 404s. Neither may cost the app its features, so
 * anything other than a well-formed non-empty list means "everything".
 */
describe('getTenantModules', () => {
  const ALL = [...MODULE_IDS];
  let getTenantModules: typeof import('./tenantModulesService').getTenantModules;

  beforeEach(async () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_URL = 'http://backend.test';
    delete process.env.API_INTERNAL_URL;
    ({ getTenantModules } = await import('./tenantModulesService'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetch = (impl: () => Promise<unknown>) => {
    global.fetch = jest.fn(impl) as unknown as typeof fetch;
  };

  const ok = (body: unknown) => mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }));

  it('returns the tenant list when the backend reports one', async () => {
    ok({ data: { modules: ['core', 'kitchen-board', 'cashier'], enforced: true } });

    await expect(getTenantModules()).resolves.toEqual(['core', 'kitchen-board', 'cashier']);
  });

  it('drops ids it does not recognise rather than trusting them', async () => {
    ok({ data: { modules: ['core', 'not-a-module', 'loyalty'] } });

    await expect(getTenantModules()).resolves.toEqual(['core', 'loyalty']);
  });

  it('falls back to every module when the endpoint 404s (an older backend)', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));

    await expect(getTenantModules()).resolves.toEqual(ALL);
  });

  it('falls back to every module when the backend is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));

    await expect(getTenantModules()).resolves.toEqual(ALL);
  });

  it.each([
    ['a malformed body', {}],
    ['a non-array modules field', { data: { modules: 'core,cashier' } }],
    ['an empty list', { data: { modules: [] } }],
    ['an all-unrecognised list', { data: { modules: ['nope', 'also-nope'] } }],
  ])('falls back to every module on %s', async (_label, body) => {
    ok(body);

    await expect(getTenantModules()).resolves.toEqual(ALL);
  });

  it('falls back to every module when no API base is configured', async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.API_INTERNAL_URL;
    const { getTenantModules: fresh } = await import('./tenantModulesService');
    mockFetch(() => Promise.reject(new Error('should not be called')));

    await expect(fresh()).resolves.toEqual(ALL);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reads the internal URL in preference to the public one', async () => {
    jest.resetModules();
    process.env.API_INTERNAL_URL = 'http://backend-internal:8080';
    process.env.NEXT_PUBLIC_API_URL = 'https://public.example';
    const { getTenantModules: fresh } = await import('./tenantModulesService');
    ok({ data: { modules: ['core'] } });

    await fresh();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend-internal:8080/api/tenant/modules',
      expect.objectContaining({ next: { revalidate: 30, tags: ['tenant-modules'] } }),
    );
  });
});
