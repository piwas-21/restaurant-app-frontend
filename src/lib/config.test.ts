export {};

const HANDOFF_REFRESH_ENV_KEY = 'NEXT_PUBLIC_STAFF_PAYMENT_HANDOFF_REFRESH_MS';
const originalValue = process.env[HANDOFF_REFRESH_ENV_KEY];
const GUEST_PAYMENT_POLICY_ENV_KEYS = [
  'NEXT_PUBLIC_GUEST_ACCOUNT_READ_TIMEOUT_MS',
  'NEXT_PUBLIC_GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS',
  'NEXT_PUBLIC_GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_MS',
] as const;
const originalGuestPaymentPolicyValues = new Map(GUEST_PAYMENT_POLICY_ENV_KEYS.map((key) => [key, process.env[key]]));

type GuestPaymentPolicyEnvironment = Partial<Record<(typeof GUEST_PAYMENT_POLICY_ENV_KEYS)[number], string>>;

async function loadRefreshInterval(value?: string): Promise<number> {
  jest.resetModules();
  if (value === undefined) delete process.env[HANDOFF_REFRESH_ENV_KEY];
  else process.env[HANDOFF_REFRESH_ENV_KEY] = value;
  return (await import('./config')).STAFF_PAYMENT_HANDOFF_REFRESH_MS;
}

async function loadGuestPaymentPolicy(values: GuestPaymentPolicyEnvironment = {}) {
  jest.resetModules();
  for (const key of GUEST_PAYMENT_POLICY_ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  const config = await import('./config');
  return {
    accountReadTimeoutMs: config.GUEST_ACCOUNT_READ_TIMEOUT_CONFIG_MS,
    recoveryMaxDurationMs: config.GUEST_PAYMENT_RECOVERY_MAX_DURATION_CONFIG_MS,
    pollDelaysMs: config.GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_CONFIG_MS,
  };
}

afterAll(() => {
  if (originalValue === undefined) delete process.env[HANDOFF_REFRESH_ENV_KEY];
  else process.env[HANDOFF_REFRESH_ENV_KEY] = originalValue;
  for (const [key, value] of originalGuestPaymentPolicyValues) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('STAFF_PAYMENT_HANDOFF_REFRESH_MS', () => {
  it('defaults to the operational 15-second cadence', async () => {
    await expect(loadRefreshInterval()).resolves.toBe(15_000);
  });

  it('accepts a positive safe-integer build override', async () => {
    await expect(loadRefreshInterval('27500')).resolves.toBe(27_500);
  });

  it.each(['', '0', '-1', 'not-a-number'])('falls back for invalid configuration %p', async (value) => {
    await expect(loadRefreshInterval(value)).resolves.toBe(15_000);
  });
});

describe('guest payment recovery timing configuration', () => {
  it('keeps the current bounded defaults when no overrides are set', async () => {
    await expect(loadGuestPaymentPolicy()).resolves.toEqual({
      accountReadTimeoutMs: 15_000,
      recoveryMaxDurationMs: 120_000,
      pollDelaysMs: [2_000, 4_000, 8_000, 16_000, 20_000, 25_000, 30_000],
    });
  });

  it('accepts finite positive overrides within all configured bounds', async () => {
    await expect(
      loadGuestPaymentPolicy({
        NEXT_PUBLIC_GUEST_ACCOUNT_READ_TIMEOUT_MS: '60000',
        NEXT_PUBLIC_GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS: '120000',
        NEXT_PUBLIC_GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_MS: '500,1000,2500',
      }),
    ).resolves.toEqual({
      accountReadTimeoutMs: 60_000,
      recoveryMaxDurationMs: 120_000,
      pollDelaysMs: [500, 1_000, 2_500],
    });
  });

  it.each(['', '0', '-1', '15000.5', 'Infinity', '60001', '9007199254740992'])(
    'falls back when account-read timeout %p is invalid or over its bound',
    async (value) => {
      await expect(loadGuestPaymentPolicy({ NEXT_PUBLIC_GUEST_ACCOUNT_READ_TIMEOUT_MS: value })).resolves.toMatchObject(
        {
          accountReadTimeoutMs: 15_000,
        },
      );
    },
  );

  it.each(['', '0', '-1', '120000.5', 'Infinity', '120001', '9007199254740992'])(
    'falls back when recovery deadline %p is invalid or over its bound',
    async (value) => {
      await expect(
        loadGuestPaymentPolicy({ NEXT_PUBLIC_GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS: value }),
      ).resolves.toMatchObject({ recoveryMaxDurationMs: 120_000 });
    },
  );

  it.each([
    '',
    '0',
    '-1',
    '1.5',
    'Infinity',
    '30001',
    '30000,30000,30000,30001',
    '30000,30000,30000,30000,1',
    '1,2,3,4,5,6,7,8,9,10,11,12,13',
    '1000,,2000',
  ])('falls back to the default poll schedule for invalid or over-bound input %p', async (value) => {
    await expect(
      loadGuestPaymentPolicy({ NEXT_PUBLIC_GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_MS: value }),
    ).resolves.toMatchObject({ pollDelaysMs: [2_000, 4_000, 8_000, 16_000, 20_000, 25_000, 30_000] });
  });

  it('allows the maximum attempt count when every delay remains within the total cap', async () => {
    await expect(
      loadGuestPaymentPolicy({
        NEXT_PUBLIC_GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_MS:
          '1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000',
      }),
    ).resolves.toMatchObject({ pollDelaysMs: Array(12).fill(1_000) });
  });

  it('accepts the maximum total delay when every attempt remains within its individual limit', async () => {
    await expect(
      loadGuestPaymentPolicy({
        NEXT_PUBLIC_GUEST_PAYMENT_RETURNED_CHECKOUT_POLL_DELAYS_MS: '30000,30000,30000,30000',
      }),
    ).resolves.toMatchObject({ pollDelaysMs: Array(4).fill(30_000) });
  });
});
