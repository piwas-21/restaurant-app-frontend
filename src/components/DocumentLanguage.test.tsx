import { render } from '@testing-library/react';
import DocumentLanguage from './DocumentLanguage';

// `mock`-prefixed so jest's out-of-scope guard allows the factory to close over it.
let mockLanguage = 'en';
let mockPathname: string | null = null;
const mockChangeLanguage = jest.fn();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      changeLanguage: mockChangeLanguage,
      get language() {
        return mockLanguage;
      },
    },
  }),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args),
    get language() {
      return mockLanguage;
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
    mockPathname = null;
    mockChangeLanguage.mockClear();
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
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe(expectedLang);
    expect(document.documentElement.dir).toBe(expectedDir);
  });

  it('switches BACK to ltr when the language changes away from Arabic', () => {
    // The direction that matters most: leaving `dir="rtl"` behind would mirror the whole app for a
    // visitor who just chose German.
    mockLanguage = 'ar';
    const { rerender } = render(<DocumentLanguage />);
    expect(document.documentElement.dir).toBe('rtl');

    mockLanguage = 'de';
    rerender(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('renders nothing into the tree', () => {
    const { container } = render(<DocumentLanguage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('follows locale-prefixed navigation and back/forward even while the root layout persists', () => {
    mockLanguage = 'en';
    mockPathname = '/fr';
    const { rerender } = render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('fr');
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr');

    mockPathname = '/en/menu';
    rerender(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    mockPathname = '/fr';
    rerender(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('fr');
    expect(mockChangeLanguage).toHaveBeenLastCalledWith('fr');
  });

  it('uses the Arabic route locale over a conflicting saved language on first response', () => {
    mockLanguage = 'en';
    mockPathname = '/ar/menu';
    render(<DocumentLanguage />);
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(mockChangeLanguage).toHaveBeenCalledWith('ar');
  });

  it('does not recreate the legacy detector cache when a locale route settles', () => {
    mockPathname = '/fr/menu';
    render(<DocumentLanguage />);
    expect(localStorage.getItem('i18nextLng')).toBeNull();
    expect(document.cookie).toContain('tenant_locale_v1=fr');
  });
});
