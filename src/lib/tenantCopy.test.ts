import {
  applyTenantCopy,
  assertKnownCopyPack,
  tenantCopyOverrides,
  TENANT_COPY_PACKS,
  KNOWN_TENANT_COPY_PACKS,
} from '@/lib/tenantCopy';
import enBundle from '@/locales/en.json';

/**
 * The contract of a tenant copy pack (tenant-1 copy leakage sweep).
 *
 * These are structural checks, not wording checks — the wording lives in tenantNeutralCopy.test.ts.
 * What is pinned here is the thing a future pack can silently get wrong: a key that no locale
 * defines (so the override is dead), a locale left out (so that language falls back to platform
 * copy while the other nine carry the tenant's), or a lookup that a crafted name can walk out of.
 */
const LOCALES = ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh'] as const;
const platform: Record<string, unknown> = enBundle;

describe('tenant copy packs', () => {
  it('ships exactly the packs the registry names', () => {
    expect(KNOWN_TENANT_COPY_PACKS).toEqual(['rumi']);
  });

  describe.each(KNOWN_TENANT_COPY_PACKS)('%s', (packName) => {
    const pack = TENANT_COPY_PACKS[packName];

    it('covers all ten locales', () => {
      expect(Object.keys(pack).sort()).toEqual([...LOCALES].sort());
    });

    it('overrides the same keys in every locale', () => {
      const reference = Object.keys(pack.en).sort();
      for (const locale of LOCALES) {
        expect(Object.keys(pack[locale]).sort()).toEqual(reference);
      }
    });

    it('only overrides keys the platform bundle already defines', () => {
      // A pack may REPLACE platform copy; it may not invent a key, because the other nine locales
      // of a tenant WITHOUT the pack would then have nothing to render.
      for (const key of Object.keys(pack.en)) {
        expect(typeof platform[key]).toBe('string');
      }
    });

    it('carries a non-empty string for every key in every locale', () => {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(pack[locale])) {
          expect(`${locale}.${key}: ${typeof value}`).toBe(`${locale}.${key}: string`);
          expect(value.trim()).not.toBe('');
        }
      }
    });

    it('actually differs from the platform copy it replaces', () => {
      // The point of a pack is that the tenant reads differently from the default. An entry equal
      // to the platform string is either a stale copy of it or a paste error, and both are silent.
      for (const [key, value] of Object.entries(pack.en)) {
        expect(value).not.toBe(platform[key]);
      }
    });
  });
});

describe('tenantCopyOverrides', () => {
  it('returns nothing when the image bakes no pack', () => {
    expect(tenantCopyOverrides('en', '')).toEqual({});
  });

  it('returns nothing for an unknown pack name', () => {
    expect(tenantCopyOverrides('en', 'no-such-tenant')).toEqual({});
  });

  it('returns nothing for a locale the pack does not cover', () => {
    expect(tenantCopyOverrides('pt', 'rumi')).toEqual({});
  });

  it('resolves the named pack and locale', () => {
    expect(tenantCopyOverrides('fr', 'rumi').home_hero_title).toBe(TENANT_COPY_PACKS.rumi.fr.home_hero_title);
  });

  it('cannot be walked out of via the prototype chain', () => {
    // Both the pack name and the locale arrive as plain strings; a bare index lookup would hand
    // `__proto__` back `Object.prototype`, whose keys are not copy.
    expect(tenantCopyOverrides('en', '__proto__')).toEqual({});
    expect(tenantCopyOverrides('__proto__', 'rumi')).toEqual({});
    expect(tenantCopyOverrides('constructor', 'rumi')).toEqual({});
  });
});

describe('applyTenantCopy', () => {
  it('returns the base bundle untouched when there are no overrides', () => {
    const base = { greeting: 'hello' };
    expect(applyTenantCopy(base, {})).toBe(base);
  });

  it('replaces only the overridden keys', () => {
    const base = { greeting: 'hello', farewell: 'bye' };
    expect(applyTenantCopy(base, { greeting: 'salut' })).toEqual({ greeting: 'salut', farewell: 'bye' });
  });

  it('does not mutate the base bundle', () => {
    const base = { greeting: 'hello' };
    applyTenantCopy(base, { greeting: 'salut' });
    expect(base.greeting).toBe('hello');
  });
});

describe('assertKnownCopyPack', () => {
  it('accepts an image that bakes no pack — the platform default', () => {
    expect(() => assertKnownCopyPack('')).not.toThrow();
  });

  it('accepts a registered pack', () => {
    expect(() => assertKnownCopyPack('rumi')).not.toThrow();
  });

  it('refuses an unknown name rather than falling back to platform copy', () => {
    // A typo in the build arg must FAIL the build. Silently serving the default is the exact
    // failure this whole mechanism exists to make impossible, and it is invisible in a green CI.
    expect(() => assertKnownCopyPack('rumii')).toThrow(/"rumii" is not a known tenant copy pack/);
    expect(() => assertKnownCopyPack('rumii')).toThrow(/known: rumi/);
  });

  it('refuses a prototype key', () => {
    expect(() => assertKnownCopyPack('__proto__')).toThrow(/not a known tenant copy pack/);
  });
});
