import type { LanguageCode } from '@/config/languageConfig';
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
import { applyTenantCopy, tenantCopyOverrides } from './tenantCopy';
import { TENANT_PUBLIC_CONFIG } from './publicDiscoveryConfig';
import type { PublicHomeData } from '@/types/publicDiscovery';
import type { LandingPageContentDto } from '@/types/landingPage';

const bundles: Record<LanguageCode, Record<string, unknown>> = { en, de, tr, it, ar, fr, nl, es, ru, zh };

export const PUBLIC_HOME_COPY_KEYS = [
  'home_hero_eyebrow',
  'home_hero_title',
  'home_hero_subtitle',
  'home_hero_subtitle_no_city',
  'home_menu_cta',
  'home_reservations_cta',
  'home_story_title',
  'home_story_content',
  'home_opening_hours_title',
  'home_opening_hours_days_1',
  'home_opening_hours_days_2',
  'home_opening_hours_time_1',
  'home_opening_hours_time_2',
  'home_location_title',
  'phone_label',
  'footer_privacy_policy',
  'footer_terms_of_usage',
  'home_footer_copyright',
  'google_maps_iframe_title',
  'google_maps_iframe_aria_label',
  'home_page_title',
  'home_page_title_no_location',
  'home_page_description',
] as const;

export const PUBLIC_MENU_COPY_KEYS = ['menu_title', 'menu_page_description'] as const;

export function hasPublicCopy(locale: LanguageCode, keys: readonly string[]): boolean {
  const merged = applyTenantCopy(bundles[locale], tenantCopyOverrides(locale));
  return keys.every((key) => typeof merged[key] === 'string' && merged[key].trim().length > 0);
}

export function publicCopyValue(locale: LanguageCode, key: string): string | undefined {
  const merged = applyTenantCopy(bundles[locale], tenantCopyOverrides(locale));
  const value = merged[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function configuredHomeLocales(): LanguageCode[] {
  return TENANT_PUBLIC_CONFIG.homeLocales.filter((locale) => hasPublicCopy(locale, PUBLIC_HOME_COPY_KEYS));
}

export function auditedHomeLocales(data: PublicHomeData): LanguageCode[] {
  if (!data.landingKnown) return [];
  const candidates = configuredHomeLocales();
  const requiredOverrides = landingOverrideKeys(data.landingPage?.content ?? {});
  if (requiredOverrides.length === 0) return candidates;
  return candidates.filter((locale) => {
    const entries = data.landingPage?.content ?? {};
    const translated = entries[locale] ?? entries[locale.split('-')[0]];
    return Boolean(translated && requiredOverrides.every((key) => hasLandingText(translated[key])));
  });
}

function landingOverrideKeys(content: Record<string, LandingPageContentDto>): Array<keyof LandingPageContentDto> {
  const keys: Array<keyof LandingPageContentDto> = [
    'heroEyebrow',
    'welcomeTitle',
    'welcomeBody',
    'storyTitle',
    'storyBody',
  ];
  return keys.filter((key) => Object.values(content).some((entry) => hasLandingText(entry[key])));
}

function hasLandingText(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function configuredMenuCopyLocales(): LanguageCode[] {
  return TENANT_PUBLIC_CONFIG.menuLocales.filter((locale) => hasPublicCopy(locale, PUBLIC_MENU_COPY_KEYS));
}
