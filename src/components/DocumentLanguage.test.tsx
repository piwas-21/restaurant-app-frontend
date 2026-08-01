import { render } from '@testing-library/react';
import DocumentLanguage from './DocumentLanguage';

// `mock`-prefixed so jest's out-of-scope guard allows the factory to close over it.
let mockLanguage = 'en';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return mockLanguage;
      },
    },
  }),
}));

/**
 * `app/layout.tsx` is a SERVER component and the locale is chosen in the BROWSER, so the rendered
 * `<html lang>` can only ever be a default. Before this component there was no correction and no
 * `dir` attribute at all: picking Arabic translated every string, left the document reading
 * left-to-right, and told a screen reader the page was English.
 */
describe('DocumentLanguage', () => {
  beforeEach(() => {
    mockLanguage = 'en';
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
});
