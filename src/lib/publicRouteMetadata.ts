import type { Metadata } from 'next';
import type { LanguageCode } from '@/config/languageConfig';
import type { PublicHomeData } from '@/types/publicDiscovery';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';
import type { WorkingHoursDto } from '@/types/workingHours';
import { RESTAURANT_NAME } from './config';
import { TENANT_PUBLIC_CONFIG } from './publicDiscoveryConfig';
import { auditedHomeLocales } from './publicHomeCoverage';
import { homePageTitle } from '@/utils/homePageTitle';
import { applyTenantCopy, tenantCopyOverrides } from './tenantCopy';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import it from '@/locales/it.json';
import nl from '@/locales/nl.json';
import ru from '@/locales/ru.json';
import tr from '@/locales/tr.json';
import zh from '@/locales/zh.json';
import ar from '@/locales/ar.json';

const copies: Record<LanguageCode, Record<string, unknown>> = { en, de, tr, it, ar, fr, nl, es, ru, zh };

export function routeCopy(locale: LanguageCode, key: string, values: Record<string, string> = {}): string {
  const bundle = applyTenantCopy(copies[locale], tenantCopyOverrides(locale));
  const template = bundle[key];
  if (typeof template !== 'string') return key;
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, name: string) => values[name] ?? match);
}

export function publicIndexingAllowed(): boolean {
  return TENANT_PUBLIC_CONFIG.indexingEnabled && TENANT_PUBLIC_CONFIG.canonicalOrigin !== null;
}

export function alternateLanguages(
  locales: readonly LanguageCode[],
  surface: 'home' | 'menu',
  page = 1,
  bundlePage = 1,
  menuView: 'products' | 'bundles' = 'products',
) {
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  if (!origin || !publicIndexingAllowed()) return undefined;
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = canonicalFor(locale, surface, page, bundlePage, menuView) ?? '';
  if (languages[TENANT_PUBLIC_CONFIG.defaultLocale])
    languages['x-default'] = languages[TENANT_PUBLIC_CONFIG.defaultLocale];
  return languages;
}

export function homeMetadata(data: PublicHomeData): Metadata {
  const info = data.restaurantInfo;
  const name = info?.name?.trim() || RESTAURANT_NAME;
  const title = homePageTitle((key, values = {}) => routeCopy(data.locale, key, asStrings(values)), {
    name,
    city: info?.city,
    country: info?.country,
  });
  const description = routeCopy(data.locale, 'home_page_description', {
    name,
    city: info?.city?.trim() || '',
    country: info?.country?.trim() || '',
    location: [info?.city?.trim(), info?.country?.trim()].filter(Boolean).join(', '),
  });
  const locales = auditedHomeLocales(data);
  const available = locales.includes(data.locale) && Boolean(info?.name?.trim());
  const canonical = canonicalFor(data.locale, 'home');
  const indexable = publicIndexingAllowed() && available && Boolean(info?.name?.trim());
  return {
    title,
    description,
    robots: { index: indexable, follow: true },
    alternates: canonical
      ? { canonical, languages: available ? alternateLanguages(locales, 'home') : undefined }
      : undefined,
    openGraph: { title, description, type: 'website', url: canonical },
  };
}

export function menuMetadata(
  locale: LanguageCode,
  locales: readonly LanguageCode[],
  page: number,
  info: RestaurantInfoDto | null = null,
  bundlePage = 1,
  menuView: 'products' | 'bundles' = 'products',
  categoryId: string | null = null,
): Metadata {
  const title = routeCopy(locale, 'menu_title');
  const description = routeCopy(locale, 'menu_page_description', {
    name: info?.name?.trim() || RESTAURANT_NAME,
    city: info?.city?.trim() || '',
  });
  const canonical = canonicalFor(locale, 'menu', page, bundlePage, menuView, categoryId);
  const hasRestaurantIdentity = Boolean(info?.name?.trim());
  const available = locales.includes(locale) && hasRestaurantIdentity;
  const alternates =
    available && !categoryId ? alternateLanguages(locales, 'menu', page, bundlePage, menuView) : undefined;
  return {
    title,
    description,
    robots: { index: publicIndexingAllowed() && available && !categoryId, follow: true },
    alternates: canonical ? { canonical, languages: alternates } : undefined,
    openGraph: { title, description, type: 'website', url: canonical },
  };
}

export function restaurantJsonLd(
  info: RestaurantInfoDto | null,
  hours: WorkingHoursDto[],
  locale: LanguageCode,
): string | null {
  if (!info?.name?.trim()) return null;
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: info.name,
    address: {
      '@type': 'PostalAddress',
      ...(info.addressLine1 ? { streetAddress: info.addressLine1 } : {}),
      ...(info.city ? { addressLocality: info.city } : {}),
      ...(info.postalCode ? { postalCode: info.postalCode } : {}),
      ...(info.country ? { addressCountry: info.country } : {}),
    },
    ...(activePhone(info) ? { telephone: activePhone(info) } : {}),
    ...(typeof info.latitude === 'number' && typeof info.longitude === 'number'
      ? { geo: { '@type': 'GeoCoordinates', latitude: info.latitude, longitude: info.longitude } }
      : {}),
    ...(origin ? { url: origin, menu: `${origin}/${locale}/menu` } : {}),
  };
  const openingHours = openingHoursForSchema(hours);
  if (openingHours.length) schema.openingHoursSpecification = openingHours;
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

function activePhone(info: RestaurantInfoDto): string | undefined {
  return info.phoneNumbers.find((phone) => phone.isActive && phone.number.trim())?.number;
}

function openingHoursForSchema(hours: WorkingHoursDto[]): Array<Record<string, string>> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return hours.flatMap((row) => {
    if (!row.isActive || row.isClosed) return [];
    const day =
      typeof row.dayOfWeek === 'number'
        ? row.dayOfWeek
        : dayNames.findIndex((name) => name.toLowerCase() === String(row.dayOfWeek).toLowerCase());
    const windows = row.shifts?.length ? row.shifts : [{ openTime: row.openTime, closeTime: row.closeTime }];
    return windows
      .filter((window) => day >= 0 && day < 7 && validTime(window.openTime) && validTime(window.closeTime))
      .map((window) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${dayNames[day]}`,
        opens: window.openTime.slice(0, 5),
        closes: window.closeTime.slice(0, 5),
      }));
  });
}

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d/.test(value);
}

function canonicalFor(
  locale: LanguageCode,
  surface: 'home' | 'menu',
  page = 1,
  bundlePage = 1,
  menuView: 'products' | 'bundles' = 'products',
  categoryId: string | null = null,
): string | undefined {
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  if (!origin) return undefined;
  const query = new URLSearchParams();
  if (surface === 'menu' && menuView === 'bundles') {
    query.set('view', 'bundles');
    if (bundlePage > 1) query.set('bundlesPage', String(bundlePage));
  } else if (surface === 'menu' && page > 1) {
    query.set('page', String(page));
  }
  if (surface === 'menu' && menuView === 'products' && categoryId) query.set('categoryId', categoryId);
  const search = query.toString();
  return `${origin}/${locale}${surface === 'menu' ? '/menu' : ''}${search ? `?${search}` : ''}`;
}

function asStrings(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? '')]));
}
