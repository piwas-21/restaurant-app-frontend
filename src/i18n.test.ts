import i18n from './i18n';
import i18next from 'i18next';
import { primeLocaleMessages } from './i18n';
import { createLocaleBackend } from './lib/localeBackend';
import { loadLocaleMessages, normalizeBundleLocale } from './lib/localeResourceLoader';

describe('locale resource loading', () => {
  it('keeps English available synchronously and loads a selected locale on demand', async () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('de', 'translation')).toBe(false);

    await i18n.changeLanguage('de');

    expect(i18n.hasResourceBundle('de', 'translation')).toBe(true);
    expect(i18n.t('deliveryChannels.workspace.overview')).toBe('Übersicht');
  });

  it('normalizes regional language tags and falls back for unsupported languages', () => {
    expect(normalizeBundleLocale('fr-CH')).toBe('fr');
    expect(normalizeBundleLocale('pt-BR')).toBe('en');
  });

  it('primes a server-selected locale before a route instance is rendered', async () => {
    const messages = await loadLocaleMessages('fr');
    primeLocaleMessages('fr', messages);

    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(true);
    expect(i18n.getResourceBundle('fr', 'translation')).toMatchObject(messages);
    const routeI18n = i18n.cloneInstance({ lng: 'fr' });
    expect(routeI18n.t('deliveryChannels.workspace.overview')).toBe('Vue d’ensemble');
  });

  it('keeps the latest language choice when locale chunks finish in a different order', async () => {
    const pendingReads = new Map<string, (messages: Record<string, unknown>) => void>();
    const backend = createLocaleBackend(
      (locale) =>
        new Promise((resolve) => {
          pendingReads.set(locale, resolve);
        }),
    );
    const instance = i18next.createInstance();
    await instance.use(backend).init({
      resources: { en: { translation: { greeting: 'Hello' } } },
      partialBundledLanguages: true,
      fallbackLng: 'en',
      lng: 'en',
      ns: ['translation'],
      defaultNS: 'translation',
    });
    const changedLanguages: string[] = [];
    instance.on('languageChanged', (language) => changedLanguages.push(language));

    const earlierChoice = instance.changeLanguage('de');
    const latestChoice = instance.changeLanguage('nl');
    expect(pendingReads.has('de')).toBe(true);
    expect(pendingReads.has('nl')).toBe(true);
    pendingReads.get('nl')?.({ greeting: 'Hallo' });
    await latestChoice;
    pendingReads.get('de')?.({ greeting: 'Guten Tag' });
    await earlierChoice;

    expect(instance.language).toBe('nl');
    expect(instance.resolvedLanguage).toBe('nl');
    expect(instance.t('greeting')).toBe('Hallo');
    expect(changedLanguages).toEqual(['nl']);
  });
});
