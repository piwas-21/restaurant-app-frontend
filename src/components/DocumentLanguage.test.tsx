import { render, waitFor } from '@testing-library/react';
import DocumentLanguage from './DocumentLanguage';

// `mock`-prefixed so jest's out-of-scope guard allows the factory to close over it.
let mockLanguage = 'en';
let mockResolvedLanguage = 'en';
let mockBaseLanguage = 'en';
let mockBaseResolvedLanguage = 'en';
let mockPathname: string | null = null;
let mockLoadedLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
const mockHasResourceBundle = jest.fn((locale: string) => mockLoadedLocales.has(locale));
const mockChangeLanguage = jest.fn(async (locale: string) => {
  mockLanguage = locale;
  if (mockLoadedLocales.has(locale)) mockResolvedLanguage = locale;
  else mockResolvedLanguage = 'en';
});
const mockBaseChangeLanguage = jest.fn(async (locale: string) => {
  mockBaseLanguage = locale;
  if (mockLoadedLocales.has(locale)) mockBaseResolvedLanguage = locale;
  else mockBaseResolvedLanguage = 'en';
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      changeLanguage: mockChangeLanguage,
      hasResourceBundle: mockHasResourceBundle,
      get language() {
        return mockLanguage;
      },
      get resolvedLanguage() {
        return mockResolvedLanguage;
      },
    },
  }),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    changeLanguage: (locale: string) => mockBaseChangeLanguage(locale),
    hasResourceBundle: (locale: string) => mockHasResourceBundle(locale),
    get language() {
      return mockBaseLanguage;
    },
    get resolvedLanguage() {
      return mockBaseResolvedLanguage;
    },
  },
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => mockPathname,
}));

/**
 * Public locale routes set the document language in SSR; this observer keeps it synchronized when
 * a persistent App Router layout moves between URLs or browser history entries.
 */
describe('DocumentLanguage', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockResolvedLanguage = 'en';
    mockBaseLanguage = 'en';
    mockBaseResolvedLanguage = 'en';
    mockPathname = null;
    mockChangeLanguage.mockClear();
    mockBaseChangeLanguage.mockClear();
    mockHasResourceBundle.mockClear();
    mockLoadedLocales = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
    localStorage.removeItem('i18nextLng');
    document.cookie = 'tenant_locale_v1=; Path=/; Max-Age=0';
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
  });

  // `zh` earns its row: it is the half with no downside — correct speech synthesis and font
  // selection with zero layout movement. `ar-EG` earns its row because a browser sends the regioned
  // tag, and matching only the exact string `ar` would leave a real visitor left-to-right.
  it.each([
    ['en', 'en', 'ltr'],
    ['ar', 'ar', 'rtl'],
    ['zh', 'zh', 'ltr'],
    ['ar-EG', 'ar', 'rtl'],
  ])('i18n language %s -> lang=%s dir=%s', (language, expectedLang, expectedDir) => {
    mockLanguage = language;
    mockResolvedLanguage = expectedLang;
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe(expectedLang);
    expect(document.documentElement.dir).toBe(expectedDir);
  });

  it('switches BACK to ltr when the language changes away from Arabic', () => {
    // The direction that matters most: leaving `dir="rtl"` behind would mirror the whole app for a
    // visitor who just chose German.
    mockLanguage = 'ar';
    mockResolvedLanguage = 'ar';
    mockBaseLanguage = 'ar';
    mockBaseResolvedLanguage = 'ar';
    const { rerender } = render(<DocumentLanguage />);
    expect(document.documentElement.dir).toBe('rtl');

    mockLanguage = 'de';
    mockResolvedLanguage = 'de';
    mockBaseLanguage = 'de';
    mockBaseResolvedLanguage = 'de';
    rerender(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('renders nothing into the tree', () => {
    const { container } = render(<DocumentLanguage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('follows locale-prefixed navigation and back/forward even while the root layout persists', async () => {
    mockLanguage = 'en';
    mockResolvedLanguage = 'en';
    mockBaseLanguage = 'en';
    mockBaseResolvedLanguage = 'en';
    mockPathname = '/fr';
    const { rerender } = render(<DocumentLanguage />);
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr');

    mockPathname = '/en/menu';
    rerender(<DocumentLanguage />);
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(document.documentElement.dir).toBe('ltr');

    mockPathname = '/fr';
    rerender(<DocumentLanguage />);
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
    expect(mockChangeLanguage).toHaveBeenLastCalledWith('fr');
  });

  it('uses the Arabic route locale over a conflicting saved language on first response', async () => {
    mockLanguage = 'en';
    mockResolvedLanguage = 'en';
    mockBaseLanguage = 'en';
    mockBaseResolvedLanguage = 'en';
    mockPathname = '/ar/menu';
    render(<DocumentLanguage />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'ar'));
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(mockChangeLanguage).toHaveBeenCalledWith('ar');
  });

  it('does not recreate the legacy detector cache when a locale route settles', async () => {
    mockPathname = '/fr/menu';
    render(<DocumentLanguage />);
    expect(localStorage.getItem('i18nextLng')).toBeNull();
    await waitFor(() => expect(document.cookie).toContain('tenant_locale_v1=fr'));
  });

  it('keeps the current document language and saved preference when a route bundle fails', async () => {
    mockLanguage = 'de';
    mockResolvedLanguage = 'de';
    mockBaseLanguage = 'de';
    mockBaseResolvedLanguage = 'de';
    mockPathname = '/nl/menu';
    mockLoadedLocales.delete('nl');
    document.cookie = 'tenant_locale_v1=de; Path=/';
    const failed = jest.fn();
    window.addEventListener('tenant-locale-load-failed', failed);
    render(<DocumentLanguage />);
    await waitFor(() => expect(failed).toHaveBeenCalled());
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.cookie).toContain('tenant_locale_v1=de');
    expect(mockLanguage).toBe('de');
    expect(mockResolvedLanguage).toBe('de');
    expect(mockBaseLanguage).toBe('de');
    expect(mockBaseResolvedLanguage).toBe('de');
    window.removeEventListener('tenant-locale-load-failed', failed);
  });
});
