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

  it('leaves an English document alone', () => {
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets lang and dir for Arabic', () => {
    mockLanguage = 'ar';
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets lang without flipping direction for a non-RTL locale', () => {
    // The half with no downside: correct speech synthesis and font selection, zero layout movement.
    mockLanguage = 'zh';
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('zh');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('normalises a regioned tag', () => {
    mockLanguage = 'ar-EG';
    render(<DocumentLanguage />);
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
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
