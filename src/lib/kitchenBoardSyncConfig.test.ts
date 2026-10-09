export {};

const envKey = 'NEXT_PUBLIC_KITCHEN_BOARD_SYNC_INTERVAL_MS';
const originalValue = process.env[envKey];

async function loadInterval(value?: string): Promise<number> {
  jest.resetModules();
  if (value === undefined) delete process.env[envKey];
  else process.env[envKey] = value;
  return (await import('./config')).KITCHEN_BOARD_SYNC_INTERVAL_MS;
}

afterAll(() => {
  if (originalValue === undefined) delete process.env[envKey];
  else process.env[envKey] = originalValue;
});

it('keeps the current kitchen cadence when configuration is omitted', async () => {
  await expect(loadInterval()).resolves.toBe(15_000);
});

it.each(['1000', '27500', '60000'])('accepts a bounded build override %p', async (value) => {
  await expect(loadInterval(value)).resolves.toBe(Number(value));
});

it.each(['', '0', '-1', '999', '60001', '1500.5', 'Infinity', 'invalid', '2147483648'])(
  'falls back for an unsafe polling interval %p',
  async (value) => {
    await expect(loadInterval(value)).resolves.toBe(15_000);
  },
);
