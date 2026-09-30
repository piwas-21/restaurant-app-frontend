import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';

export interface LocalizedTextEntry {
  name?: string | null;
  description?: string | null;
}

export type LocalizedTextMap = Readonly<Record<string, LocalizedTextEntry | undefined>>;

export interface LocalizedTextSource {
  name: string;
  description?: string | null;
  sourceLocale?: string | null;
  content?: LocalizedTextMap;
}

export function localizedEntry(content: LocalizedTextMap | undefined, locale: string): LocalizedTextEntry | undefined {
  if (!content) return undefined;
  const entries = Object.entries(content);
  const exactLocale = locale.toLowerCase();
  const base = baseLocale(locale);
  const exact = entries.find(([key]) => key.toLowerCase() === exactLocale)?.[1];
  const baseEntry = entries.find(([key]) => key.toLowerCase() === base)?.[1];
  const regionalEntry = entries.find(([key]) => baseLocale(key) === base)?.[1];
  const candidates = [exact, baseEntry, regionalEntry].filter(
    (entry, index, all): entry is LocalizedTextEntry => Boolean(entry) && all.indexOf(entry) === index,
  );
  const name = candidates.find((entry) => nonBlank(entry.name))?.name;
  const description = candidates.find((entry) => nonBlank(entry.description))?.description;
  return name !== undefined || description !== undefined ? { name, description } : undefined;
}

/** Resolve requested language, then the declared source language, never an unrelated English entry. */
export function resolvePublicLocalizedText(
  source: LocalizedTextSource,
  locale: string,
  defaultLocale: string,
): { name: string; description: string } {
  const requested = localizedEntry(source.content, locale);
  const sourceLanguage = source.sourceLocale?.trim() || defaultLocale;
  const authored = localizedEntry(source.content, sourceLanguage);
  const name = nonBlank(requested?.name) ?? nonBlank(authored?.name) ?? source.name;
  const description =
    nonBlank(requested?.description) ?? nonBlank(authored?.description) ?? source.description?.trim() ?? '';
  return { name, description };
}

export function resolveTenantPublicLocalizedText(
  source: LocalizedTextSource,
  locale: string,
): { name: string; description: string } {
  return resolvePublicLocalizedText(source, locale, TENANT_PUBLIC_CONFIG.defaultLocale);
}

function baseLocale(locale: string): string {
  return locale.trim().toLowerCase().split(/[-_]/, 1)[0];
}

function nonBlank(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
