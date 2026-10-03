import { act, render, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import baseI18n, { primeLocaleMessages } from '../i18n';
import { changeLocaleWhenReady } from '../lib/changeLocaleWhenReady';
import { loadLocaleMessages } from '../lib/localeResourceLoader';
import type { LanguageCode } from '../config/languageConfig';
import DocumentLanguage from '../components/DocumentLanguage';
import { useRouteI18n } from './useRouteI18n';

jest.mock('next/navigation', () => ({ usePathname: () => '/en/cart' }));

function RouteLocaleProbe({ messages, locale }: { messages: Record<string, unknown>; locale: LanguageCode }) {
  const instance = useRouteI18n(locale, messages);
  return (
    <I18nextProvider i18n={instance}>
      <DocumentLanguage />
      <RouteInstanceProbe instance={instance} />
    </I18nextProvider>
  );
}

let latestRouteInstance: I18nInstance | null = null;

function getLatestRouteInstance(): I18nInstance {
  if (!latestRouteInstance) throw new Error('The route i18n instance was not rendered');
  return latestRouteInstance;
}

function RouteInstanceProbe({ instance }: { instance: I18nInstance }) {
  latestRouteInstance = instance;
  return null;
}

function holdAfterApplying(instance: I18nInstance, locale: string) {
  const originalChangeLanguage = instance.changeLanguage.bind(instance);
  let release: (() => void) | undefined;
  const spy = jest.spyOn(instance, 'changeLanguage').mockImplementation((nextLocale) => {
    const applied = originalChangeLanguage(nextLocale);
    if (nextLocale !== locale) return applied;
    return applied.then(
      (translator) =>
        new Promise<typeof translator>((resolve) => {
          release = () => resolve(translator);
        }),
    );
  });

  return {
    release: () => release?.(),
    spy,
  };
}

it('keeps the route clone stable when server message props get a new identity during a locale switch', async () => {
  const frenchMessages = await loadLocaleMessages('fr');
  primeLocaleMessages('fr', frenchMessages);
  await baseI18n.changeLanguage('en');
  latestRouteInstance = null;

  const firstMessages = { greeting: 'Hello' };
  const { rerender } = render(<RouteLocaleProbe messages={firstMessages} locale="en" />);
  await waitFor(() => expect(getLatestRouteInstance().isInitialized).toBe(true));
  const routeInstance = getLatestRouteInstance();

  const routeGate = holdAfterApplying(routeInstance, 'fr');
  const baseGate = holdAfterApplying(baseI18n, 'fr');
  let routeChange: Promise<boolean> | undefined;
  let baseChange: Promise<boolean> | undefined;
  act(() => {
    routeChange = changeLocaleWhenReady(routeInstance, 'fr', 'fr');
    baseChange = changeLocaleWhenReady(baseI18n, 'fr', 'fr');
  });
  await waitFor(() => {
    expect(routeInstance.resolvedLanguage).toBe('fr');
    expect(baseI18n.resolvedLanguage).toBe('fr');
  });

  rerender(<RouteLocaleProbe messages={{ ...firstMessages }} locale="en" />);
  expect(latestRouteInstance).toBe(routeInstance);
  expect(baseGate.spy.mock.calls.map(([language]) => language)).toEqual(['fr']);

  await act(async () => {
    routeGate.release();
    baseGate.release();
    await Promise.all([routeChange, baseChange]);
  });
  expect(await routeChange).toBe(true);
  expect(await baseChange).toBe(true);
  expect(routeInstance.resolvedLanguage).toBe('fr');
  expect(baseI18n.resolvedLanguage).toBe('fr');
  routeGate.spy.mockRestore();
  baseGate.spy.mockRestore();
});
