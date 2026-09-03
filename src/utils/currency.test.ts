/**
 * Unit tests for the tenant-currency utilities (per-tenant currency
 * consumption; pairs with backend `LocalizationSettings.Currency` and the
 * deploy repo registry `currency:` field).
 *
 * NEXT_PUBLIC_TENANT_CURRENCY and NEXT_PUBLIC_TENANT_LOCALE are inlined at
 * build time by Next.js, but under Jest they are plain env reads, so module
 * reload (jest.resetModules) with a mutated process.env exercises the
 * resolution logic for both.
 *
 * The exact-string assertions on formatPlainCurrency prove the default (CHF)
 * build renders byte-identical output for every replaced
 * `CHF ${x.toFixed(2)}` template-literal site. The formatCurrency assertions
 * compare against the historical inline Intl.NumberFormat implementations
 * they replaced, proving those sites byte-identical too (independent of the
 * ICU build).
 */

const ENV_KEY = 'NEXT_PUBLIC_TENANT_CURRENCY';
const LOCALE_ENV_KEY = 'NEXT_PUBLIC_TENANT_LOCALE';
const originalEnvValue = process.env[ENV_KEY];
const originalLocaleEnvValue = process.env[LOCALE_ENV_KEY];

function setEnv(key: string, value?: string) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function loadCurrency(envValue?: string, localeValue?: string): Promise<typeof import('./currency')> {
  jest.resetModules();
  setEnv(ENV_KEY, envValue);
  setEnv(LOCALE_ENV_KEY, localeValue);
  return import('./currency');
}

afterAll(() => {
  setEnv(ENV_KEY, originalEnvValue);
  setEnv(LOCALE_ENV_KEY, originalLocaleEnvValue);
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

describe('TENANT_LOCALE resolution', () => {
  it('defaults to de-CH when the env var is unset, empty or whitespace', async () => {
    expect((await loadCurrency(undefined, undefined)).TENANT_LOCALE).toBe('de-CH');
    expect((await loadCurrency(undefined, '')).TENANT_LOCALE).toBe('de-CH');
    expect((await loadCurrency(undefined, '   ')).TENANT_LOCALE).toBe('de-CH');
  });

  it('uses a valid BCP-47 override, trimmed', async () => {
    expect((await loadCurrency(undefined, 'fr-FR')).TENANT_LOCALE).toBe('fr-FR');
    expect((await loadCurrency(undefined, '  fr-FR  ')).TENANT_LOCALE).toBe('fr-FR');
    expect((await loadCurrency(undefined, 'nl')).TENANT_LOCALE).toBe('nl');
  });

  it('canonicalises case the way Intl does', async () => {
    expect((await loadCurrency(undefined, 'DE-ch')).TENANT_LOCALE).toBe('de-CH');
    expect((await loadCurrency(undefined, 'FR-fr')).TENANT_LOCALE).toBe('fr-FR');
  });

  it('falls back to de-CH (never throws) on structurally invalid tags', async () => {
    for (const junk of ['de_CH', 'junk!', '123', 'a', 'en--US', '€']) {
      expect((await loadCurrency(undefined, junk)).TENANT_LOCALE).toBe('de-CH');
    }
  });
});

describe('a fr-FR / EUR tenant (the case a hard-coded de-CH got wrong)', () => {
  it('formatPlainCurrency places the symbol the French way instead of prefixing the code', async () => {
    const { formatPlainCurrency } = await loadCurrency('EUR', 'fr-FR');
    expect(formatPlainCurrency(8)).toBe('8,00 €');
    expect(formatPlainCurrency(19.99)).toBe('19,99 €');
    expect(formatPlainCurrency(0, 0)).toBe('0 €');
  });

  it('still refuses thousands separators, and signs negatives ahead of the amount', async () => {
    const { formatPlainCurrency } = await loadCurrency('EUR', 'fr-FR');
    expect(formatPlainCurrency(1234.5)).toBe('1234,50 €');
    expect(formatPlainCurrency(-3.5)).toBe('-3,50 €');
  });

  it('renders a missing amount as the currency marker alone', async () => {
    const { formatPlainCurrency } = await loadCurrency('EUR', 'fr-FR');
    expect(formatPlainCurrency(undefined)).toBe(' €');
    expect(formatPlainCurrency(null)).toBe(' €');
  });

  it('formatCurrency defaults to the tenant locale, not de-CH', async () => {
    const { formatCurrency } = await loadCurrency('EUR', 'fr-FR');
    for (const value of [0, 19.99, 1234.5]) {
      expect(formatCurrency(value)).toBe(
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value),
      );
    }
  });

  it('normalises the non-breaking space Intl inserts, so no U+00A0 reaches the DOM', async () => {
    const { formatPlainCurrency } = await loadCurrency('EUR', 'fr-FR');
    const chf = await loadCurrency(undefined, undefined);
    expect(formatPlainCurrency(8)).not.toMatch(/[\u00A0\u202F]/);
    expect(chf.formatPlainCurrency(8)).not.toMatch(/[\u00A0\u202F]/);
  });
});

describe('formatPlainCurrency rounding (deliberate change from toFixed)', () => {
  /**
   * The two helpers still separate code from amount differently — `formatCurrency` hands back
   * Intl's U+00A0 untouched (its byte-identity tests above pin that), while `formatPlainCurrency`
   * normalises it to keep the strings its template literals produced. That predates this change,
   * so these comparisons are about the DIGITS, and normalise the separator away.
   */
  const digitsOf = (formatted: string) => formatted.replace(/[\u00A0\u202F]/g, ' ');

  it('rounds an exact half-cent away from zero, the way formatCurrency always has', async () => {
    const { formatPlainCurrency, formatCurrency } = await loadCurrency(undefined, undefined);
    // `toFixed` rounded the underlying binary double, which is a hair BELOW 1.005, and returned
    // "1.00" — disagreeing with formatCurrency on the very same number. Intl rounds the decimal.
    expect((1.005).toFixed(2)).toBe('1.00');
    expect(formatPlainCurrency(1.005)).toBe('CHF 1.01');
    expect(digitsOf(formatCurrency(1.005))).toBe('CHF 1.01');
    expect(formatPlainCurrency(2.675)).toBe('CHF 2.68');
  });

  it('agrees with formatCurrency on every non-negative value below a thousand', async () => {
    const { formatPlainCurrency, formatCurrency } = await loadCurrency(undefined, undefined);
    for (const value of [0, 0.05, 2.5, 19.99, 999.99, 1.005, 2.675]) {
      expect(formatPlainCurrency(value)).toBe(digitsOf(formatCurrency(value, undefined, undefined, 2)));
    }
  });

  it('keeps the legacy space before a negative that Intl alone drops', async () => {
    const { formatPlainCurrency, formatCurrency } = await loadCurrency(undefined, undefined);
    // Intl pushes the minus between code and amount and drops the separator entirely; every call
    // site this helper replaced rendered `CHF ${(-3.5).toFixed(2)}`, so the space has to survive.
    expect(digitsOf(formatCurrency(-3.5))).toBe('CHF-3.50');
    expect(formatPlainCurrency(-3.5)).toBe('CHF -3.50');
  });
});

describe('formatPlainCurrency degenerate amounts', () => {
  it('renders NaN and -0 exactly as the template literal did', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined, undefined);
    // NaN is neither >= 0 nor < 0; it must not pick up a minus on the way through the sign branch.
    expect(formatPlainCurrency(NaN)).toBe('CHF NaN');
    expect(formatPlainCurrency(-0)).toBe('CHF 0.00');
  });

  it('keeps the sign on an infinite amount (Intl prints the symbol, toFixed spelled it out)', async () => {
    const { formatPlainCurrency } = await loadCurrency(undefined, undefined);
    expect(formatPlainCurrency(Infinity)).toBe('CHF \u221E');
    expect(formatPlainCurrency(-Infinity)).toBe('CHF -\u221E');
  });
});
