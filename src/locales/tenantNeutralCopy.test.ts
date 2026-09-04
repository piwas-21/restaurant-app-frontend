import { TENANT_COPY_PACKS } from '@/lib/tenantCopy';
// Suffixed rather than named after their locale: `import it from './it.json'` shadows Jest's own
// `it`, and the suite then fails to load with "_it.default.each is not a function".
import arBundle from './ar.json';
import deBundle from './de.json';
import enBundle from './en.json';
import esBundle from './es.json';
import frBundle from './fr.json';
import itBundle from './it.json';
import nlBundle from './nl.json';
import ruBundle from './ru.json';
import trBundle from './tr.json';
import zhBundle from './zh.json';

/**
 * The shared bundle may not carry TENANT 1's identity.
 *
 * `scripts/check-locale-parity.mjs` already swept 63 hardcoded "Genève"/"Женеве"/"日内瓦" out of
 * these files and left the honest limit in a comment: *"this gate only compares placeholders that
 * EXIST in en.json, so a key that hardcodes a tenant value in the ENGLISH source has nothing to
 * compare and stays invisible here — no amount of green proves the English is tenant-neutral.
 * Finding the next one means reading en.json, not re-running this."*
 *
 * There was a next one, and it was found by reading a customer's website, not en.json: a French
 * restaurant provisioned 2026-08-19 announced "Authentic Turkish Cuisine" and published
 * "… in Montreal-la-Cluse, Switzerland". This file is the gate that comment says does not exist —
 * it reads the VALUES, in every locale, for the words that name tenant 1's cuisine and country.
 *
 * It is deliberately not a `{{placeholder}}` check. The defect is not a lost interpolation; it is
 * one restaurant's identity used as the platform default.
 */
const BUNDLES = {
  en: enBundle,
  de: deBundle,
  tr: trBundle,
  it: itBundle,
  ar: arBundle,
  fr: frBundle,
  nl: nlBundle,
  es: esBundle,
  ru: ruBundle,
  zh: zhBundle,
} as const;
type Locale = keyof typeof BUNDLES;
const LOCALES = Object.keys(BUNDLES) as Locale[];

/**
 * What tenant 1 is, in each language: Turkish / Turkey, Switzerland, Geneva.
 *
 * Substrings, lower-cased, chosen to survive inflection ("türkische", "turque", "турецкая") and to
 * avoid a capital that case-folds badly (Turkish "İsviçre" → "sviçre"). Over-matching is the safe
 * direction: a false positive is one allowlist row with a reason, a false negative is a customer's
 * home page telling their guests they serve someone else's food.
 */
const TENANT_ONE_IDENTITY: Record<Locale, readonly string[]> = {
  en: ['turkish', 'turkey', 'switzerland', 'geneva'],
  de: ['türkisch', 'türkei', 'schweiz', 'genf'],
  tr: ['ürk', 'sviçre', 'enevre'],
  it: ['turc', 'turchia', 'svizzera', 'ginevra'],
  ar: ['تركي', 'تركيا', 'سويسرا', 'جنيف'],
  fr: ['turqu', 'turc', 'suisse', 'genève'],
  nl: ['turks', 'turkije', 'zwitserland', 'genève'],
  es: ['turc', 'turquía', 'suiza', 'ginebra'],
  ru: ['турец', 'турци', 'швейцари', 'женев'],
  zh: ['土耳其', '瑞士', '日内瓦'],
};

/**
 * Keys allowed to name Turkey or Switzerland, each with the reason.
 *
 * Everything here that is NOT a false positive or a proper noun is residual tenant-1 leakage on a
 * surface this sweep did not cover. It is listed rather than fixed so it is visible and countable;
 * the point of the allowlist is that it may shrink but must not silently grow.
 */
const ALLOWED = new Map<string, string>([
  // Proper nouns: the NAME of a language, in the language switcher and the profile form.
  ['turkish', 'the language "Türkçe" in the locale switcher'],
  ['lang_tr', 'the name of a language'],
  ['language_tr', 'the name of a language'],
  // Seeded DEMO MENU content — a catalogue of dishes, not the venue's positioning. A tenant that
  // does not sell sarma simply never renders these.
  ['sarma_description', 'seeded demo menu item'],
  ['iskender_kebab_special_description', 'seeded demo menu item'],
  ['pide', 'seeded demo menu item'],
  ['turkishSpecialty', 'seeded demo menu category'],
  // False positive: Arabic التركيز ("focus") contains تركي.
  ['focus_search_input', 'Arabic substring collision: التركيز = "focus"'],
  // DEBT — Swiss defaults on other surfaces, reported alongside this change and not fixed here.
  ['enter_country', 'DEBT: CH example value in an admin form placeholder'],
  ['tax_description_placeholder', 'DEBT: CH example value in an admin form placeholder'],
  ['postal_code_invalid', 'DEBT: tells a French guest to enter a "Swiss postal code"'],
  ['order_types_hint', 'DEBT: cites Swiss VAT regulation in the tax admin'],
  ['fidelity_rule_1', 'DEBT: hardcodes CHF although NEXT_PUBLIC_TENANT_CURRENCY exists'],
  ['fidelity_rule_2', 'DEBT: hardcodes CHF although NEXT_PUBLIC_TENANT_CURRENCY exists'],
]);

/** The home-page + SEO copy this sweep neutralised. Held separately: these may never be allowlisted. */
const HOME_AND_SEO_KEYS = [
  'home_hero_eyebrow',
  'home_hero_title',
  'home_hero_subtitle',
  'home_hero_subtitle_no_city',
  'home_page_title',
  'home_page_title_no_location',
  'home_page_description',
  'home_story_content',
  'menu_page_description',
  'reservations_form_intro',
] as const;

const leaksIn = (locale: Locale, value: string): string[] =>
  TENANT_ONE_IDENTITY[locale].filter((needle) => value.toLowerCase().includes(needle));

describe('the shared locale bundle is tenant-neutral', () => {
  it.each(LOCALES)('%s: no home-page or SEO string names tenant 1', (locale) => {
    const bundle: Record<string, unknown> = BUNDLES[locale];
    const offenders = HOME_AND_SEO_KEYS.flatMap((key) =>
      leaksIn(locale, String(bundle[key])).map((needle) => `${key} contains "${needle}": ${String(bundle[key])}`),
    );
    expect(offenders).toEqual([]);
  });

  it.each(LOCALES)('%s: every remaining mention of tenant 1 is allowlisted with a reason', (locale) => {
    const bundle: Record<string, unknown> = BUNDLES[locale];
    const offenders = Object.entries(bundle)
      .filter(([key, value]) => typeof value === 'string' && !ALLOWED.has(key) && leaksIn(locale, value).length > 0)
      .map(([key, value]) => `${key}: ${String(value)}`);
    expect(offenders).toEqual([]);
  });

  it('no longer defines a key NAMED after tenant 1\u2019s cuisine', () => {
    // The key was `authentic_turkish_cuisine`. A neutral value under that name would still have
    // taught the next reader that the platform default is a Turkish restaurant.
    for (const locale of LOCALES) {
      expect(BUNDLES[locale]).not.toHaveProperty('authentic_turkish_cuisine');
    }
  });

  it('defines every home-page and SEO key in all ten locales', () => {
    for (const locale of LOCALES) {
      for (const key of HOME_AND_SEO_KEYS) {
        const bundle: Record<string, unknown> = BUNDLES[locale];
        expect(`${locale}.${key}`).toBe(typeof bundle[key] === 'string' ? `${locale}.${key}` : 'MISSING');
      }
    }
  });
});

describe('RUMI keeps its own identity, because it really is that restaurant', () => {
  it.each(LOCALES)('%s: the rumi pack still says Turkish', (locale) => {
    // Two things at once. It proves tenant 1 did not lose its copy to the neutral sweep — the hard
    // constraint on this change — and it proves the needle list above is LIVE: a needle list that
    // matched nothing anywhere would pass every assertion in this file while checking nothing.
    const overrides = TENANT_COPY_PACKS.rumi[locale];
    const matched = Object.values(overrides).flatMap((value) => leaksIn(locale, value));
    expect(matched.length).toBeGreaterThan(0);
  });

  it('overrides every key the sweep neutralised', () => {
    expect(Object.keys(TENANT_COPY_PACKS.rumi.en).sort()).toEqual([...HOME_AND_SEO_KEYS].sort());
  });
});
