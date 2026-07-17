/**
 * Unit tests for the tenant-currency utilities (per-tenant currency
 * consumption; pairs with backend `LocalizationSettings.Currency` and the
 * deploy repo registry `currency:` field).
 *
 * NEXT_PUBLIC_TENANT_CURRENCY is inlined at build time by Next.js, but under
 * Jest it is a plain env read, so module reload (jest.resetModules) with a
 * mutated process.env exercises the resolution logic.
 *
 * The exact-string assertions on formatPlainCurrency prove the default (CHF)
 * build renders byte-identical output for every replaced
 * `CHF ${x.toFixed(2)}` template-literal site. The formatCurrency assertions
 * compare against the historical inline Intl.NumberFormat implementations
 * they replaced, proving those sites byte-identical too (independent of the
 * ICU build).
 */

const ENV_KEY = 'NEXT_PUBLIC_TENANT_CURRENCY';
const originalEnvValue = process.env[ENV_KEY];

async function loadCurrency(envValue?: string): Promise<typeof import('./currency')> {
  jest.resetModules();
  if (envValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = envValue;
  }
  return import('./currency');
}

afterAll(() => {
  if (originalEnvValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEnvValue;
  }
});

describe('TENANT_CURRENCY resolution', () => {
  it('defaults to CHF when the env var is unset', async () => {
    const { TENANT_CURRENCY } = await loadCurrency(undefined);
    expect(TENANT_CURRENCY).toBe('CHF');
  });

  it('defaults to CHF when the env var is empty or whitespace', async () => {
    expect((await loadCurrency('')).TENANT_CURRENCY).toBe('CHF');
    expect((await loadCurrency('   ')).TENANT_CURRENCY).toBe('CHF');
  });

  it('uses a valid 3-letter uppercase override', async () => {
    const { TENANT_CURRENCY } = await loadCurrency('EUR');
    expect(TENANT_CURRENCY).toBe('EUR');
  });

  it('trims surrounding whitespace before validating', async () => {
    const { TENANT_CURRENCY } = await loadCurrency('  EUR  ');
    expect(TENANT_CURRENCY).toBe('EUR');
  });

  it('falls back to CHF (never lowercases, never crashes) on junk values', async () => {
    for (const junk of ['eur', 'Eur', 'EURO', 'EU', 'E U', '€', 'CH1', 'chf']) {
      expect((await loadCurrency(junk)).TENANT_CURRENCY).toBe('CHF');
    }
  });
});

describe('formatPlainCurrency (default CHF build — exact strings)', () => {
  it('renders `CHF ${x.toFixed(2)}` exactly', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined);
    expect(formatPlainCurrency(19.99)).toBe('CHF 19.99');
    expect(formatPlainCurrency(5)).toBe('CHF 5.00');
    expect(formatPlainCurrency(-3.5)).toBe('CHF -3.50');
  });

  it('never inserts thousands separators (unlike Intl)', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined);
    expect(formatPlainCurrency(1234.5)).toBe('CHF 1234.50');
    expect(formatPlainCurrency(1000000)).toBe('CHF 1000000.00');
  });

  it('supports explicit decimals (replaced `toFixed(0)` and currency_zero sites)', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined);
    expect(formatPlainCurrency(0, 0)).toBe('CHF 0'); // ex-`currency_zero` locale key
    expect(formatPlainCurrency(12.345, 0)).toBe('CHF 12');
    expect(formatPlainCurrency(50, 0)).toBe('CHF 50');
  });

  it('renders null/undefined as the bare code + space, matching `CHF {maybe?.toFixed(2)}` JSX', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined);
    expect(formatPlainCurrency(undefined)).toBe('CHF ');
    expect(formatPlainCurrency(null)).toBe('CHF ');
  });

  it("preserves the `?.toFixed(2) || '0.00'` fallback semantics via `?? 0`", async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined);
    const missingTotal: number | undefined = undefined;
    const zeroTotal: number | undefined = 0;
    expect(formatPlainCurrency(missingTotal ?? 0)).toBe('CHF 0.00');
    expect(formatPlainCurrency(zeroTotal ?? 0)).toBe('CHF 0.00');
  });

  it('uses the overridden tenant currency code', async () => {
    const { formatPlainCurrency } = await loadCurrency('EUR');
    expect(formatPlainCurrency(5)).toBe('EUR 5.00');
    expect(formatPlainCurrency(0, 0)).toBe('EUR 0');
  });
});

describe('formatCurrency (byte-identical to the replaced inline Intl formatters)', () => {
  it('matches the historical de-CH/CHF inline implementation', async () => {
    const { formatCurrency } = await loadCurrency(undefined);
    const legacy = (price: number) =>
      new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(price);
    for (const value of [0, 19.99, 1234.5, 0.05, 99999.99]) {
      expect(formatCurrency(value)).toBe(legacy(value));
    }
  });

  it('matches the historical 0-fraction analytics formatters (de-CH and en-CH)', async () => {
    const { formatCurrency, TENANT_CURRENCY } = await loadCurrency(undefined);
    const legacy = (locale: string) => (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    for (const value of [0, 12.5, 1234.5]) {
      expect(formatCurrency(value, 'de-CH', TENANT_CURRENCY, 0)).toBe(legacy('de-CH')(value));
      expect(formatCurrency(value, 'en-CH', TENANT_CURRENCY, 0)).toBe(legacy('en-CH')(value));
    }
  });

  it('matches the historical forced-2-fraction tip/cart formatters', async () => {
    const { formatCurrency } = await loadCurrency(undefined);
    const legacy = (price: number) =>
      new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    for (const value of [0, 2.5, 19.99]) {
      expect(formatCurrency(value)).toBe(legacy(value));
    }
  });

  it('honours explicit locale/currency parameters', async () => {
    const { formatCurrency } = await loadCurrency(undefined);
    expect(formatCurrency(5, 'de-CH', 'EUR')).toBe(
      new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(5),
    );
  });

  it('uses the overridden tenant currency as its default code', async () => {
    const { formatCurrency } = await loadCurrency('EUR');
    expect(formatCurrency(5)).toBe(new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(5));
  });
});
