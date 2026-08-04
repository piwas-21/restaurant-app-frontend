import { baseLanguage, directionFor } from './textDirection';

describe('baseLanguage', () => {
  it.each([
    ['ar', 'ar'],
    ['ar-EG', 'ar'],
    ['AR-eg', 'ar'],
    ['en-GB', 'en'],
    ['zh-Hans-CN', 'zh'],
  ])('%s -> %s', (input, expected) => {
    expect(baseLanguage(input)).toBe(expected);
  });

  // i18next can hand back an empty string before detection resolves; a blank `lang` attribute is
  // worse than a wrong one, because it tells a screen reader nothing at all.
  it.each(['', undefined as unknown as string])('falls back to en for %p', (input) => {
    expect(baseLanguage(input)).toBe('en');
  });
});

describe('directionFor', () => {
  // The ten locales the app actually ships. Pinned as a table rather than "ar is rtl" so adding a
  // locale to `i18n.ts` without deciding its direction shows up here.
  it.each([
    ['en', 'ltr'],
    ['de', 'ltr'],
    ['tr', 'ltr'],
    ['it', 'ltr'],
    ['fr', 'ltr'],
    ['nl', 'ltr'],
    ['es', 'ltr'],
    ['ru', 'ltr'],
    ['zh', 'ltr'],
    ['ar', 'rtl'],
  ])('%s reads %s', (locale, expected) => {
    expect(directionFor(locale)).toBe(expected);
  });

  it('resolves a regioned Arabic tag as rtl', () => {
    // `ar-EG` is what a browser sends; matching only the exact string `ar` would leave a real
    // visitor left-to-right.
    expect(directionFor('ar-SA')).toBe('rtl');
  });

  it('treats an unknown locale as ltr rather than throwing', () => {
    expect(directionFor('xx')).toBe('ltr');
  });
});
