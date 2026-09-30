import type { LanguageCode } from '@/config/languageConfig';
import type { ApiCategory } from '@/types/menu';
import type { MenuBundleDto, ProductDto } from '@/hooks/publicMenu/types';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';
import { TENANT_PUBLIC_CONFIG } from './publicDiscoveryConfig';
import { mapCategoryNameToTranslationKey } from '@/utils/categoryNameMapper';
import { publicCopyValue } from './publicHomeCoverage';
import { localizedEntry, type LocalizedTextMap } from '@/utils/publicLocalizedText';

export interface MenuLocaleCoverage {
  locale: LanguageCode;
  complete: boolean;
  itemCount: number;
  missingCategories: number;
  missingProducts: number;
  missingBundles: number;
  missingOfferText: number;
}

export interface MenuCoverageReport {
  known: boolean;
  locales: LanguageCode[];
  byLocale: MenuLocaleCoverage[];
}

type LocalizedMap = LocalizedTextMap | undefined;

function baseLocale(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toLowerCase().split(/[-_]/, 1)[0];
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function mayUseSource(locale: string, sourceLocale: string | null | undefined, defaultLocale: string): boolean {
  const knownSource = baseLocale(sourceLocale);
  if (knownSource) return knownSource === baseLocale(locale);
  return baseLocale(locale) === baseLocale(defaultLocale);
}

function entityIsCovered(
  locale: string,
  defaultLocale: string,
  sourceLocale: string | null | undefined,
  sourceName: string | null | undefined,
  sourceDescription: string | null | undefined,
  content: LocalizedMap,
): boolean {
  if (!hasText(sourceName)) return false;
  if (mayUseSource(locale, sourceLocale, defaultLocale)) return true;
  const translated = localizedEntry(content, locale);
  return Boolean(hasText(translated?.name) && (!hasText(sourceDescription) || hasText(translated?.description)));
}

function activeProducts(products: readonly ProductDto[]): ProductDto[] {
  return products.filter(
    (product) => product.isActive !== false && product.isAvailable !== false && product.isComponent !== true,
  );
}

function activeBundles(bundles: readonly MenuBundleDto[]): MenuBundleDto[] {
  return bundles.filter((bundle) => bundle.isActive !== false && bundle.isAvailable !== false);
}

function categoryCovered(category: ApiCategory, locale: LanguageCode, defaultLocale: LanguageCode): boolean {
  if (
    entityIsCovered(
      locale,
      defaultLocale,
      category.sourceLocale,
      category.name,
      category.description,
      category.translations,
    )
  ) {
    return true;
  }
  const explicit = localizedEntry(category.translations, locale);
  if (hasText(explicit?.name) && (!hasText(category.description) || hasText(explicit?.description))) return true;
  const source = baseLocale(category.sourceLocale);
  if (source && source !== baseLocale(locale)) return false;
  if (hasText(category.description)) return false;
  const key = mapCategoryNameToTranslationKey(category.name);
  const copy = publicCopyValue(locale, key);
  return Boolean(copy && copy.toLowerCase() !== key.toLowerCase());
}

export function auditMenuLocaleCoverage(
  input: {
    categories: readonly ApiCategory[] | null;
    products: readonly ProductDto[] | null;
    bundles: readonly MenuBundleDto[] | null;
    offerFamilies?: readonly CatalogOfferFamily[] | null;
  },
  options: {
    candidates?: readonly LanguageCode[];
    defaultLocale?: LanguageCode;
    sourceDataKnown?: boolean;
  } = {},
): MenuCoverageReport {
  const candidates = options.candidates ?? TENANT_PUBLIC_CONFIG.menuLocales;
  const defaultLocale = options.defaultLocale ?? TENANT_PUBLIC_CONFIG.defaultLocale;
  const known =
    options.sourceDataKnown !== false &&
    input.categories !== null &&
    input.products !== null &&
    input.bundles !== null &&
    (!Object.hasOwn(input, 'offerFamilies') || input.offerFamilies !== null);
  const categories = input.categories ?? [];
  const products = activeProducts(input.products ?? []);
  const bundles = activeBundles(input.bundles ?? []);
  const offerFamilies = input.offerFamilies ?? [];
  const itemCount = products.length + bundles.length + offerFamilies.length;

  const byLocale = candidates.map((locale): MenuLocaleCoverage => {
    const missingCategories = categories.filter((category) => !categoryCovered(category, locale, defaultLocale)).length;
    const missingProducts = products.filter(
      (product) =>
        !entityIsCovered(
          locale,
          defaultLocale,
          product.sourceLocale,
          product.name,
          product.description,
          product.content,
        ),
    ).length;
    const missingBundles = bundles.filter(
      (bundle) =>
        !entityIsCovered(locale, defaultLocale, bundle.sourceLocale, bundle.name, bundle.description, bundle.content),
    ).length;
    const missingOfferText = offerFamilies.reduce((missing, family) => {
      const anchor = family.anchor;
      const anchorCovered = entityIsCovered(
        locale,
        defaultLocale,
        anchor.sourceLocale,
        anchor.name,
        anchor.description,
        anchor.content,
      );
      const targetsCovered = family.menuOffers.every(
        (target) =>
          !hasText(target.name) ||
          entityIsCovered(locale, defaultLocale, target.sourceLocale, target.name, target.description, target.content),
      );
      return missing + Number(!anchorCovered || !targetsCovered);
    }, 0);
    return {
      locale,
      complete: known && itemCount > 0 && missingCategories + missingProducts + missingBundles + missingOfferText === 0,
      itemCount,
      missingCategories,
      missingProducts,
      missingBundles,
      missingOfferText,
    };
  });

  return {
    known,
    locales: byLocale.filter((entry) => entry.complete).map((entry) => entry.locale),
    byLocale,
  };
}
