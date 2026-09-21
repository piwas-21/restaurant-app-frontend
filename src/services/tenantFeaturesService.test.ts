describe('getTenantFeatures', () => {
  let getTenantFeatures: typeof import('./tenantFeaturesService').getTenantFeatures;

  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_URL = 'http://backend.test';
    delete process.env.API_INTERNAL_URL;
    // The service captures the server API base at module load, so each case gets a clean
    // configuration boundary just like the tenant-modules service tests.
    return import('./tenantFeaturesService').then((service) => {
      getTenantFeatures = service.getTenantFeatures;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetch = (implementation: () => Promise<unknown>) => {
    global.fetch = jest.fn(implementation) as unknown as typeof fetch;
  };

  it('returns an enabled rollout flag', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { serverWorkspaceV2: true } }) }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: true });
    expect(global.fetch).toHaveBeenCalledWith('http://backend.test/api/tenant/features', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it('returns the disabled default when the backend reports false', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { serverWorkspaceV2: false } }) }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: false });
  });

  it.each([
    ['a malformed body', {}],
    ['a missing flag', { success: true, data: {} }],
    ['a string flag', { success: true, data: { serverWorkspaceV2: 'true' } }],
  ])('fails closed on %s', async (_label, body) => {
    mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }));

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: false });
  });

  it('fails closed when success is false even if the data says enabled', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, data: { serverWorkspaceV2: true } }) }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: false });
  });

  it('fails closed when an older backend returns 404', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: false });
  });

  it('fails closed when the backend is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));

    await expect(getTenantFeatures()).resolves.toEqual({ serverWorkspaceV2: false });
  });

  it('fails closed when no API base is configured', async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.API_INTERNAL_URL;
    const { getTenantFeatures: fresh } = await import('./tenantFeaturesService');
    mockFetch(() => Promise.reject(new Error('should not be called')));

    await expect(fresh()).resolves.toEqual({ serverWorkspaceV2: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
