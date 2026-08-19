import { firstPaintCopy, FIRST_PAINT_LOCALE, type CopyFn } from '@/lib/firstPaintCopy';
import i18n from '../i18n';
import enBundle from '@/locales/en.json';

/**
 * The pre-hydration half of the two-pass home render.
 *
 * Jest resolves `NEXT_PUBLIC_TENANT_COPY_PACK` to unset, i.e. the PLATFORM build every self-serve
 * tenant gets — the case that was broken, so the one worth pinning here. The pack path is covered
 * structurally in tenantCopy.test.ts.
 */
const platform: Record<string, unknown> = enBundle;

describe('firstPaintCopy', () => {
  const translate = jest.fn((key: string) => `translated:${key}`) as unknown as CopyFn;

  beforeEach(() => (translate as unknown as jest.Mock).mockClear());
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it("leaves the visitor's language to the caller's own t after hydration", () => {
    // The post-hydration branch is now literally the caller's `t` (`isClient ? t : firstPaintCopy(i18n)`),
    // so what is worth pinning is that this module does NOT stand between the caller and it.
    expect(translate('home_story_title')).toBe('translated:home_story_title');
    expect(translate).toHaveBeenCalledWith('home_story_title');
  });

  it('uses the English bundle before hydration', () => {
    expect(firstPaintCopy(i18n)('home_story_title')).toBe(platform.home_story_title);
    expect(translate).not.toHaveBeenCalled();
  });

  it('interpolates before hydration', () => {
    const copy = firstPaintCopy(i18n);
    expect(copy('home_hero_subtitle', { city: 'Montreal-la-Cluse' })).toBe(
      'Your Culinary Journey Begins Here in Montreal-la-Cluse',
    );
    expect(copy('home_footer_copyright', { year: 2026, name: "O'Bresse" })).toBe(
      "© 2026 O'Bresse. All rights reserved.",
    );
  });

  it('stays English however the visitor has since switched language', async () => {
    // The whole reason the pre-hydration branch exists: it is the SERVER's pass. If it followed the
    // detected language it could not match the HTML the browser is hydrating.
    await i18n.changeLanguage('fr');
    expect(i18n.t('home_story_title')).toBe('Notre histoire');
    expect(firstPaintCopy(i18n)('home_story_title')).toBe(platform.home_story_title);
  });

  it('resolves both the flat dotted and the nested key shapes this bundle mixes', () => {
    // en.json holds a `cashier` OBJECT and 182 flat `cashier.*` keys; i18next's own resolver
    // handles both, which is a reason to go through it rather than index the JSON by hand.
    const copy = firstPaintCopy(i18n);
    expect(copy('user_menu.logout')).toBe(platform['user_menu.logout']);
    expect(copy('cashier.zreport.error')).toBe('Failed to load Z-Report');
  });

  it('pins the first paint to the language the server falls back to', () => {
    expect(FIRST_PAINT_LOCALE).toBe('en');
  });
});
