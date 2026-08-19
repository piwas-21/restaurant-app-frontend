import { homePageTitle } from '@/utils/homePageTitle';
import type { CopyFn, CopyVars } from '@/lib/firstPaintCopy';

/**
 * The <title> of a tenant's home page.
 *
 * Pinned because the string it replaces was wrong on a live customer: `home_page_title` spelled
 * "Switzerland" into all ten locales, so a French restaurant provisioned 2026-08-19 published
 * "… in Montreal-la-Cluse, Switzerland". The country is data now, and the degenerate case (no
 * RestaurantInfo yet) must not print bare punctuation.
 */
const spyCopy = (): { copy: CopyFn; calls: Array<[string, CopyVars | undefined]> } => {
  const calls: Array<[string, CopyVars | undefined]> = [];
  const copy: CopyFn = (key, vars) => {
    calls.push([key, vars]);
    return `${key}|${JSON.stringify(vars ?? {})}`;
  };
  return { copy, calls };
};

describe('homePageTitle', () => {
  it('joins city and country into one location', () => {
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: "O'Bresse", city: 'Montreal-la-Cluse', country: 'France' });
    expect(calls).toEqual([
      [
        'home_page_title',
        { name: "O'Bresse", city: 'Montreal-la-Cluse', country: 'France', location: 'Montreal-la-Cluse, France' },
      ],
    ]);
  });

  it('names no country when the tenant has not recorded one', () => {
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'RUMI Restaurant', city: 'Geneva' });
    expect(calls[0][0]).toBe('home_page_title');
    expect(calls[0][1]).toMatchObject({ location: 'Geneva', country: '' });
  });

  it('names no city when only a country is known', () => {
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'RUMI Restaurant', country: 'Switzerland' });
    expect(calls[0][1]).toMatchObject({ location: 'Switzerland', city: '' });
  });

  it('falls back to the location-less variant rather than printing bare punctuation', () => {
    // The window before RestaurantInfo has loaded. The old string interpolated both as empty and
    // rendered "Name - Authentic Turkish Cuisine in , Switzerland".
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'Restaurant' });
    expect(calls).toEqual([['home_page_title_no_location', { name: 'Restaurant' }]]);
  });

  it('treats whitespace-only and null address fields as absent', () => {
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'Restaurant', city: '   ', country: null });
    expect(calls[0][0]).toBe('home_page_title_no_location');
  });

  it('trims a padded city and country', () => {
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'Restaurant', city: '  Geneva ', country: ' Switzerland  ' });
    expect(calls[0][1]).toMatchObject({ location: 'Geneva, Switzerland' });
  });

  it('still passes city and country, so a tenant pack may word its own title around them', () => {
    // RUMI's pack names its country in prose and interpolates only {{city}} — i18next ignores the
    // values a string does not use, but they have to be THERE.
    const { copy, calls } = spyCopy();
    homePageTitle(copy, { name: 'RUMI Restaurant', city: 'Geneva', country: 'Switzerland' });
    expect(calls[0][1]).toMatchObject({ city: 'Geneva', country: 'Switzerland' });
  });
});
