import i18next from 'i18next';
import english from '@/locales/en.json';
import englishAmendments from '@/locales/order-workspace/en.json';
import arabic from '@/locales/order-workspace/ar.json';
import german from '@/locales/order-workspace/de.json';
import spanish from '@/locales/order-workspace/es.json';
import french from '@/locales/order-workspace/fr.json';
import italian from '@/locales/order-workspace/it.json';
import dutch from '@/locales/order-workspace/nl.json';
import russian from '@/locales/order-workspace/ru.json';
import turkish from '@/locales/order-workspace/tr.json';
import chinese from '@/locales/order-workspace/zh.json';
import { loadOrderAmendmentTranslations } from './orderAmendmentTranslations';
import { loadServerOrderTranslations } from './serverOrderTranslations';
import type { OrderWorkspaceLocaleBundle } from './orderWorkspaceTranslations';

const bundles: Record<string, OrderWorkspaceLocaleBundle> = {
  en: englishAmendments,
  ar: arabic,
  de: german,
  es: spanish,
  fr: french,
  it: italian,
  nl: dutch,
  ru: russian,
  tr: turkish,
  zh: chinese,
};

function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null ? keysOf(child, path) : [path];
  });
}

describe('order amendment locale chunks', () => {
  it('keeps feature copy out of the shared base locale and supplies matching keys in all ten locales', () => {
    expect(english).not.toHaveProperty('orderAmendments');
    expect(english).not.toHaveProperty('serverOrders');
    const englishKeys = keysOf(bundles.en.orderAmendments);
    const serverOrderKeys = keysOf(bundles.en.serverOrders);
    for (const [locale, bundle] of Object.entries(bundles)) {
      expect({ locale, keys: keysOf(bundle.orderAmendments) }).toEqual({ locale, keys: englishKeys });
      expect({ locale, keys: keysOf(bundle.serverOrders) }).toEqual({ locale, keys: serverOrderKeys });
      expect(Object.values(bundle.orderAmendments).every((value) => typeof value === 'string' && value.trim())).toBe(
        true,
      );
    }
  });

  it('adds only the requested locale while preserving existing resources and de-duplicates concurrent loads', async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'de-CH',
      fallbackLng: 'en',
      resources: { de: { translation: { cashier: { title: 'Kasse' } } } },
    });

    const amendmentLoad = loadOrderAmendmentTranslations(instance, instance.language);
    const serverLoad = loadServerOrderTranslations(instance, instance.language);
    expect(serverLoad).toBe(amendmentLoad);
    await Promise.all([amendmentLoad, serverLoad]);

    expect(instance.getResource('de', 'translation', 'orderAmendments.open')).toBe('Bestellung ändern');
    expect(instance.getResource('de', 'translation', 'serverOrders.title')).toBe('Bestellungen');
    expect(instance.getResource('de', 'translation', 'cashier.title')).toBe('Kasse');
    expect(instance.getResource('en', 'translation', 'orderAmendments')).toBeUndefined();
  });
});
