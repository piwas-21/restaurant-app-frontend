export {};

const HANDOFF_REFRESH_ENV_KEY = 'NEXT_PUBLIC_STAFF_PAYMENT_HANDOFF_REFRESH_MS';
const originalValue = process.env[HANDOFF_REFRESH_ENV_KEY];

async function loadRefreshInterval(value?: string): Promise<number> {
  jest.resetModules();
  if (value === undefined) delete process.env[HANDOFF_REFRESH_ENV_KEY];
  else process.env[HANDOFF_REFRESH_ENV_KEY] = value;
  return (await import('./config')).STAFF_PAYMENT_HANDOFF_REFRESH_MS;
}

afterAll(() => {
  if (originalValue === undefined) delete process.env[HANDOFF_REFRESH_ENV_KEY];
  else process.env[HANDOFF_REFRESH_ENV_KEY] = originalValue;
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
