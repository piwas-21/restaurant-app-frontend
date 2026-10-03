describe('getTenantFeatures', () => {
  let getTenantFeatures: typeof import('./tenantFeaturesService').getTenantFeatures;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NEXT_PUBLIC_API_URL = 'http://backend.test';
    process.env.TENANT_FEATURES_REQUEST_TIMEOUT_MS = '3000';
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

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: true,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
    expect(global.fetch).toHaveBeenCalledWith('http://backend.test/api/tenant/features', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it('returns the disabled default when the backend reports false', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { serverWorkspaceV2: false } }) }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('reads the additive table account presentation flag', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { serverWorkspaceV2: true, tableAccountV1: true } }),
      }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: true,
      tableAccountV1: true,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('reads the additive order amendment flag independently', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { serverWorkspaceV2: false, tableAccountV1: false, orderAmendmentsV1: true },
          }),
      }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: true,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('reads guest visit admission independently from account payment collection', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { tableGuestVisitsV1: true } }),
      }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: true,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it.each([true, false, 'true', 1, null, undefined])(
    'accepts only an explicit boolean for account payment collection (%s)',
    async (flag) => {
      mockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { tableAccountPaymentsV1: flag } }),
        }),
      );

      await expect(getTenantFeatures()).resolves.toEqual({
        serverWorkspaceV2: false,
        tableAccountV1: false,
        orderAmendmentsV1: false,
        tableGuestVisitsV1: false,
        tableVisitReadinessV1: false,
        tableAccountPaymentsV1: flag === true ? true : false,
      });
    },
  );

  it.each([
    ['a malformed body', {}],
    ['a missing flag', { success: true, data: {} }],
    ['a string flag', { success: true, data: { serverWorkspaceV2: 'true' } }],
  ])('fails closed on %s', async (_label, body) => {
    mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }));

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('fails closed when success is false even if the data says enabled', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, data: { serverWorkspaceV2: true } }) }),
    );

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('fails closed when an older backend returns 404', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('fails closed when the backend is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));

    await expect(getTenantFeatures()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
  });

  it('fails closed when no API base is configured', async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.API_INTERNAL_URL;
    const { getTenantFeatures: fresh } = await import('./tenantFeaturesService');
    mockFetch(() => Promise.reject(new Error('should not be called')));

    await expect(fresh()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([true, false, 'true', 1, null, undefined])(
    'requires explicit true for table readiness (%s)',
    async (flag) => {
      mockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { tableVisitReadinessV1: flag } }),
        }),
      );
      await expect(getTenantFeatures()).resolves.toMatchObject({ tableVisitReadinessV1: flag === true });
    },
  );

  it.each(['', '0', '-1', 'not-a-number'])('fails closed for invalid timeout configuration %p', async (timeout) => {
    jest.resetModules();
    process.env.TENANT_FEATURES_REQUEST_TIMEOUT_MS = timeout;
    const { getTenantFeatures: fresh } = await import('./tenantFeaturesService');
    mockFetch(() => Promise.reject(new Error('should not be called')));

    await expect(fresh()).resolves.toEqual({
      serverWorkspaceV2: false,
      tableAccountV1: false,
      orderAmendmentsV1: false,
      tableGuestVisitsV1: false,
      tableVisitReadinessV1: false,
      tableAccountPaymentsV1: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
