/**
 * Per-tenant COPY overlay (tenant-1 copy leakage, follow-up to SOFRA-ONBOARDING-PLAN O6).
 *
 * WHY THIS EXISTS. `src/locales/*.json` is the PLATFORM bundle: it is what every tenant image
 * inherits when nothing overrides it, so anything tenant-specific in it is that tenant's identity
 * leaking onto every other restaurant on the platform. It used to say "Authentic Turkish Cuisine",
 * "Discover Authentic Turkish Flavors" and "…in {{city}}, Switzerland" — true of RUMI, and printed
 * verbatim on a French bistro's home page and <title> the day it was provisioned.
 *
 * O6 made exactly this split for ASSETS: `public/branding/` became the SofraPiwas default set and
 * RUMI's own hero/icon moved to `public/branding-rumi/`, applied by build-image.yml's prod job.
 * This is the same split for WORDS. The shared bundle is cuisine-neutral; a tenant with copy of its
 * own puts it in `src/locales/tenant/<pack>/<locale>.json` and bakes
 * `NEXT_PUBLIC_TENANT_COPY_PACK=<pack>` into its image.
 *
 * WHY A PACK AND NOT A `RestaurantInfo.tagline` FIELD (the alternative O6 would suggest). A single
 * admin-editable string cannot be translated: RUMI serves its Turkish positioning in ten languages
 * today, and one free-text field would render "Authentic Turkish Cuisine" to a German visitor who
 * currently reads "Authentische türkische Küche". The hard constraint on this change is that RUMI
 * prod reads EXACTLY as it does today, and only a per-locale overlay can promise that. A backend
 * field remains the right home for a self-serve tenant's own one-line tagline — see
 * docs/TENANT-COPY.md — but it is a different feature from "stop shipping tenant 1's identity".
 */
import { TENANT_COPY_PACK } from './config';
import { rumiCopy } from '@/locales/tenant/rumi';

/** One locale's overrides: i18n key → the tenant's own string for it. */
export type CopyOverrides = Readonly<Record<string, string>>;

/** A tenant's whole pack: locale code → that locale's overrides. */
export type TenantCopyPack = Readonly<Record<string, CopyOverrides>>;

const NO_OVERRIDES: CopyOverrides = Object.freeze({});

/** Every pack that ships in the source tree, by the name a build bakes into NEXT_PUBLIC_TENANT_COPY_PACK. */
export const TENANT_COPY_PACKS: Readonly<Record<string, TenantCopyPack>> = Object.freeze({ rumi: rumiCopy });

export const KNOWN_TENANT_COPY_PACKS: readonly string[] = Object.keys(TENANT_COPY_PACKS);

/**
 * A typo in the build arg must not be a silent fall-through to the platform copy — that is the
 * failure mode this whole file exists to remove. `NEXT_PUBLIC_*` is baked at build time and this
 * module is loaded while Next pre-renders, so an unknown name fails `npm run build` rather than
 * shipping an image whose copy is quietly wrong. Same posture as next.config.ts's unknown-template
 * guard (ADR-006). Exported so the rule can be exercised without a second module instance.
 */
export function assertKnownCopyPack(packName: string): void {
  if (!packName || Object.hasOwn(TENANT_COPY_PACKS, packName)) return;
  throw new Error(
    `NEXT_PUBLIC_TENANT_COPY_PACK="${packName}" is not a known tenant copy pack ` +
      `(known: ${KNOWN_TENANT_COPY_PACKS.join(', ') || 'none'}). ` +
      'Add src/locales/tenant/<pack>/<locale>.json and register it here. See docs/TENANT-COPY.md.',
  );
}

assertKnownCopyPack(TENANT_COPY_PACK);

/**
 * The overrides this image applies to one locale. Empty for every tenant that has no pack, which
 * is the platform default and by far the common case.
 *
 * `Object.hasOwn` rather than a bare lookup on both maps: the pack name and the locale both reach
 * here as plain strings, and `packs['__proto__']` would otherwise hand back `Object.prototype`.
 */
export function tenantCopyOverrides(locale: string, packName: string = TENANT_COPY_PACK): CopyOverrides {
  if (!packName || !Object.hasOwn(TENANT_COPY_PACKS, packName)) return NO_OVERRIDES;
  const pack = TENANT_COPY_PACKS[packName];
  return Object.hasOwn(pack, locale) ? pack[locale] : NO_OVERRIDES;
}

/**
 * Lay a tenant's overrides over one locale bundle. Flat by design: a pack may only REPLACE a key
 * the platform bundle already defines (asserted in tenantCopy.test.ts), so there is nothing to
 * deep-merge and no way for a pack to invent a key that no locale has.
 */
export function applyTenantCopy<T extends Record<string, unknown>>(base: T, overrides: CopyOverrides): T {
  if (Object.keys(overrides).length === 0) return base;
  return { ...base, ...overrides } as T;
}
