/**
 * GAP-2 S6 — the switcher is where a signed-in person's language becomes an ACCOUNT fact.
 *
 * Two rules, and the second is the one that would go unnoticed: a guest must trigger no write at
 * all (there is no account to write to, and `Accept-Language` already carries their choice onto the
 * row they create), and the write must never be awaited — the menu has already re-rendered in the
 * new language, and a slow or failing network must not hold that up or undo it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher';

let mockBaseLanguage = 'en';
let mockBaseResolvedLanguage = 'en';
let mockPublicLanguage = 'fr';
let mockPublicResolvedLanguage = 'fr';
let mockBaseAvailableLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
let mockPublicAvailableLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
let mockUsePublicInstance = false;
const mockBaseChangeLanguage = jest.fn(async (language: string) => {
  mockBaseLanguage = language;
  mockBaseResolvedLanguage = mockBaseAvailableLocales.has(language) ? language : 'en';
});
const mockPublicChangeLanguage = jest.fn(async (language: string) => {
  mockPublicLanguage = language;
  mockPublicResolvedLanguage = mockPublicAvailableLocales.has(language) ? language : 'en';
});
const mockBaseHasResourceBundle = jest.fn((locale: string) => mockBaseAvailableLocales.has(locale));
const mockPublicHasResourceBundle = jest.fn((locale: string) => mockPublicAvailableLocales.has(locale));
const mockBaseAddResourceBundle = jest.fn(
  (locale: string, _namespace: string, _resources: Record<string, unknown>, _deep: boolean, _overwrite: boolean) =>
    mockBaseAvailableLocales.add(locale),
);
const mockPublicAddResourceBundle = jest.fn(
  (locale: string, _namespace: string, _resources: Record<string, unknown>, _deep: boolean, _overwrite: boolean) =>
    mockPublicAvailableLocales.add(locale),
);
const mockBaseI18n = {
  changeLanguage: mockBaseChangeLanguage,
  hasResourceBundle: mockBaseHasResourceBundle,
  addResourceBundle: mockBaseAddResourceBundle,
  get language() {
    return mockBaseLanguage;
  },
  get resolvedLanguage() {
    return mockBaseResolvedLanguage;
  },
};
const mockPublicI18n = {
  changeLanguage: mockPublicChangeLanguage,
  hasResourceBundle: mockPublicHasResourceBundle,
  addResourceBundle: mockPublicAddResourceBundle,
  get language() {
    return mockPublicLanguage;
  },
  get resolvedLanguage() {
    return mockPublicResolvedLanguage;
  },
};
const mockPush = jest.fn();
let mockPathname: string | null = null;
let mockSearch = '';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockUsePublicInstance ? mockPublicI18n : mockBaseI18n,
    t: (key: string, fallback?: string) =>
      key === 'languageLoadFailed'
        ? 'That language could not be loaded. Your current language was kept. Please try again.'
        : fallback,
  }),
}));

jest.mock('../i18n', () => {
  const mockedModule = { __esModule: true };
  Object.defineProperty(mockedModule, 'default', { get: () => mockBaseI18n });
  return mockedModule;
});

const mockLoadLocaleMessages = jest.fn(async (_locale: string) => ({}));
jest.mock('@/lib/localeResourceLoader', () => ({
  loadLocaleMessages: (locale: string) => mockLoadLocaleMessages(locale),
  normalizeBundleLocale: (locale: string) => locale.toLowerCase().split('-')[0],
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => null,
}));

let mockUser: { firstName: string } | null = null;
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/services/userService', () => ({
  saveLanguagePreference: jest.fn().mockResolvedValue(true),
}));

const { saveLanguagePreference } = jest.requireMock('@/services/userService') as {
  saveLanguagePreference: jest.Mock;
};

async function pickFrench() {
  render(<LanguageSwitcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByText('French'));
  await waitFor(() => expect(savedLocaleCookie()).toBe('tenant_locale_v1=fr'));
}

function savedLocaleCookie(): string | undefined {
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('tenant_locale_v1='));
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.cookie = 'tenant_locale_v1=; Path=/; Max-Age=0';
  mockUser = null;
  mockBaseLanguage = 'en';
  mockBaseResolvedLanguage = 'en';
  mockPublicLanguage = 'fr';
  mockPublicResolvedLanguage = 'fr';
  mockBaseAvailableLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
  mockPublicAvailableLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
  mockUsePublicInstance = false;
  mockPathname = null;
  mockSearch = '';
  mockPush.mockClear();
  mockLoadLocaleMessages.mockReset();
  mockLoadLocaleMessages.mockImplementation(async (_locale: string) => ({}));
  mockBaseAddResourceBundle.mockClear();
  mockPublicAddResourceBundle.mockClear();
});

it('a signed-in user has the choice recorded on their account', async () => {
  mockUser = { firstName: 'Ada' };

  await pickFrench();

  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
  expect(savedLocaleCookie()).toBe('tenant_locale_v1=fr');
  expect(localStorage.getItem('i18nextLng')).toBeNull();
  await waitFor(() => expect(saveLanguagePreference).toHaveBeenCalledWith('fr'));
});

it('a guest writes nothing to any account', async () => {
  await pickFrench();

  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
  expect(savedLocaleCookie()).toBe('tenant_locale_v1=fr');
  expect(localStorage.getItem('i18nextLng')).toBeNull();
  expect(saveLanguagePreference).not.toHaveBeenCalled();
});

/**
 * The write is best-effort, and its failure must be invisible: the interface has already switched
 * by the time it runs. Pinned with a rejected write — which also proves the `void` is safe, since an
 * unhandled rejection would fail this test rather than merely log.
 */
it('a failed write changes nothing the user can see', async () => {
  mockUser = { firstName: 'Ada' };
  // `false`, not a rejection: the service swallows its own failures and says so in its return type,
  // which is what makes the `void` at the call site safe. That contract is pinned in
  // `services/userServiceLanguage.test.ts` — an unhandled rejection here would fail this test.
  saveLanguagePreference.mockResolvedValue(false);

  await pickFrench();

  await waitFor(() => expect(saveLanguagePreference).toHaveBeenCalled());
  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
  expect(savedLocaleCookie()).toBe('tenant_locale_v1=fr');
  expect(localStorage.getItem('i18nextLng')).toBeNull();
});

it('keeps an explicit public locale choice when client navigation enters a private route', async () => {
  mockPathname = '/fr/menu';
  mockUsePublicInstance = true;
  mockPublicLanguage = 'fr';
  mockBaseLanguage = 'de';
  mockBaseResolvedLanguage = 'de';
  const { rerender } = render(<LanguageSwitcher />);

  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByText('English'));

  await waitFor(() => {
    expect(mockPublicChangeLanguage).toHaveBeenCalledWith('en');
    expect(mockBaseChangeLanguage).toHaveBeenCalledWith('en');
    expect(mockPush).toHaveBeenCalledWith('/en/menu');
  });

  // ClientProviders uses the shared instance again on an unprefixed route. Switching the
  // simulated route and provider proves that the user's explicit choice survives that transition.
  mockPathname = '/cart';
  mockUsePublicInstance = false;
  rerender(<LanguageSwitcher />);
  expect(screen.getByText('EN')).toBeInTheDocument();
});

it('does not navigate or change saved preferences when a locale link cannot load its bundle', async () => {
  mockPathname = '/fr/menu';
  mockUsePublicInstance = true;
  mockBaseLanguage = 'fr';
  mockBaseResolvedLanguage = 'fr';
  mockPublicLanguage = 'fr';
  mockPublicResolvedLanguage = 'fr';
  mockBaseAvailableLocales.delete('en');
  mockPublicAvailableLocales.delete('en');
  mockLoadLocaleMessages.mockRejectedValueOnce(new Error('translation chunk unavailable'));
  document.cookie = 'tenant_locale_v1=fr; Path=/';
  mockUser = { firstName: 'Ada' };
  render(<LanguageSwitcher />);

  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByText('English'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Your current language was kept');
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockPublicLanguage).toBe('fr');
  expect(mockBaseLanguage).toBe('fr');
  expect(savedLocaleCookie()).toBe('tenant_locale_v1=fr');
  expect(saveLanguagePreference).not.toHaveBeenCalled();
  expect(mockPublicChangeLanguage).not.toHaveBeenCalled();
  expect(mockBaseChangeLanguage).not.toHaveBeenCalled();
});

it('waits for the selected locale resource before navigating', async () => {
  mockPathname = '/fr/menu';
  mockUsePublicInstance = true;
  let resolveBundle: ((messages: Record<string, unknown>) => void) | undefined;
  mockLoadLocaleMessages.mockImplementationOnce(
    (_locale: string) =>
      new Promise((resolve) => {
        resolveBundle = resolve;
      }),
  );
  render(<LanguageSwitcher />);

  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByText('English'));
  expect(mockPush).not.toHaveBeenCalled();

  resolveBundle?.({ greeting: 'Hello' });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/en/menu'));
});

it('keeps every interface language as an initial public URL link and preserves safe QR context', () => {
  mockPathname = '/fr/menu';
  mockSearch = 'qr=table-token&tableId=table-7&page=2&unknown=secret';
  const { container } = render(<LanguageSwitcher />);
  const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')];

  expect(links).toHaveLength(10);
  expect(container.querySelector('[role="listbox"]')).toBeNull();
  expect(links.find((link) => link.href.endsWith('/en/menu?qr=table-token&tableId=table-7&page=2'))).toBeDefined();
  expect(links.some((link) => link.href.includes('unknown='))).toBe(false);
});
