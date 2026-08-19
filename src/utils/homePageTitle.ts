/**
 * The document title of the home page.
 *
 * Two things it fixes, both measured on a live tenant (a French restaurant provisioned 2026-08-19
 * whose <title> read "… - Authentic Turkish Cuisine in Montreal-la-Cluse, Switzerland"):
 *
 *  1. the COUNTRY is no longer a literal in the copy. `home_page_title` hardcoded "Switzerland" in
 *     all ten locales, so every tenant outside CH published a factually wrong title. The country is
 *     data — `RestaurantInfo.country`, the same field the address block already renders.
 *  2. an unloaded or partial `RestaurantInfo` no longer prints its own punctuation. Interpolating an
 *     empty city and country produced "Name - Restaurant in , " on the most quoted string on the
 *     site; a location-less variant covers that window instead, exactly as
 *     `home_hero_subtitle_no_city` already did for the hero.
 */
import type { CopyFn } from '@/lib/firstPaintCopy';

export interface HomePageTitleParts {
  /** The restaurant's name — RestaurantInfo.name, or the build-time RESTAURANT_NAME while it loads. */
  name: string;
  city?: string | null;
  country?: string | null;
}

/**
 * `city` and `country` are still passed to the copy function alongside the joined `location`: a
 * tenant copy pack may legitimately word its own title around `{{city}}` (RUMI's does, because it
 * names its country in prose), and i18next ignores interpolation values a string does not use.
 */
export function homePageTitle(copy: CopyFn, { name, city, country }: HomePageTitleParts): string {
  const cityPart = city?.trim() ?? '';
  const countryPart = country?.trim() ?? '';
  const location = [cityPart, countryPart].filter(Boolean).join(', ');

  return location
    ? copy('home_page_title', { name, city: cityPart, country: countryPart, location })
    : copy('home_page_title_no_location', { name });
}
