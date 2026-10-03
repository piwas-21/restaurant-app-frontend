import { I18nextProvider, useTranslation } from 'react-i18next';
import { render, waitFor } from '@testing-library/react';
import i18next, { type i18n as I18nInstance } from 'i18next';
import { createLocaleBackend } from '@/lib/localeBackend';
import { useDocumentLanguageSync } from './useDocumentLanguageSync';

function LocaleSyncProbe({ instance, renders }: { instance: I18nInstance; renders: jest.Mock }) {
  useTranslation();
  renders();
  useDocumentLanguageSync(instance, instance, 'nl');
  return null;
}

describe('useDocumentLanguageSync', () => {
  it('does not retry a failed route bundle after real i18next language events rerender the consumer', async () => {
    const localeReads: string[] = [];
    const backend = createLocaleBackend(async (locale) => {
      localeReads.push(locale);
      throw new Error('Locale chunk unavailable');
    });
    const instance = i18next.createInstance();
    await instance.use(backend).init({
      resources: { en: { translation: { greeting: 'Hello' } } },
      partialBundledLanguages: true,
      fallbackLng: 'en',
      lng: 'en',
      ns: ['translation'],
      defaultNS: 'translation',
    });
    localeReads.length = 0;

    const failed = jest.fn();
    const renders = jest.fn();
    window.addEventListener('tenant-locale-load-failed', failed);
    render(
      <I18nextProvider i18n={instance}>
        <LocaleSyncProbe instance={instance} renders={renders} />
      </I18nextProvider>,
    );

    await waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
    expect(renders.mock.calls.length).toBeGreaterThan(1);
    expect(localeReads).toEqual(['nl']);
    expect(instance.language).toBe('en');
    expect(instance.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.cookie).not.toContain('tenant_locale_v1=nl');
    window.removeEventListener('tenant-locale-load-failed', failed);
  });
});
