/**
 * Allergen vocabulary — the single lookup shared by the menu cards, the item
 * sheet and the admin product editor. A pure table + resolver, deliberately out
 * of the component file: it is data, it is what the tests pin, and both templates
 * read it (so a miss here shows up on every menu in every skin).
 *
 * Two vocabularies live here on purpose:
 *
 * 1. **Dietary claims** (`vegan`, `gluten_free`, `halal`, …) — the values the
 *    admin form offers via {@link AVAILABLE_ALLERGENS}. A claim is a selling
 *    point: the guest chose to read it.
 * 2. **EU-14 substances** (`gluten`, `milk`, `nuts`, `sesame`, …) — the legally
 *    named allergen list, which is how a real menu is actually written and what
 *    tenants type in. These were missing once, so *every* substance name fell
 *    through to a generic fallback: on the demo menu all four distinct allergens
 *    rendered the same glyph. A substance is a "contains" warning, not a claim.
 *
 * **The table no longer carries an icon or a CSS class per entry** (D9,
 * MENU-DESIGN-CONFORMANCE-PLAN §4). It carried 25 emoji and 13 colour classes;
 * zero of the 28 classic design screens contain an emoji, and the design system
 * permits exactly one chip treatment (`DESIGN.md` §Components). What survives is
 * the only distinction the design actually draws: a substance *warning* earns a
 * glyph, a dietary *claim* does not. The glyph itself is one monochrome icon
 * chosen at the render site, so it is not per-entry data.
 */

/** Dietary CLAIMS — the admin product editor's vocabulary. No warning glyph. */
const DIETARY_CLAIMS = new Set([
  'vegan',
  'vegetarian',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'halal',
  'kosher',
  'sugar_free',
  'organic',
  'low_sodium',
  // `spicy` is a descriptor a kitchen volunteers, not one of the 14 substances a
  // menu is legally required to declare — so it reads as a claim, not a warning.
  'spicy',
]);

/** The EU-14 substances. A "contains" warning; earns the glyph. */
const EU14_SUBSTANCES = new Set([
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
]);

/** Spellings that mean an entry above — plural/US/EU variants and synonyms. */
const ALLERGEN_ALIASES: { [key: string]: string } = {
  dairy: 'milk',
  lactose: 'milk',
  wheat: 'gluten',
  soya: 'soy',
  soybeans: 'soy',
  soybean: 'soy',
  egg: 'eggs',
  peanut: 'peanuts',
  groundnuts: 'peanuts',
  nut: 'nuts',
  tree_nuts: 'nuts',
  treenuts: 'nuts',
  shellfish: 'crustaceans',
  crustacean: 'crustaceans',
  mollusca: 'molluscs',
  mollusks: 'molluscs',
  sulfites: 'sulphites',
  sulphur_dioxide: 'sulphites',
  sesame_seeds: 'sesame',
  hot: 'spicy',
};

/** Which vocabulary a token belongs to — the one thing the chip renders differently. */
export type AllergenKind = 'claim' | 'substance' | 'unknown';

export interface AllergenInfo {
  kind: AllergenKind;
  /**
   * The vocabulary entry the input resolved to — `dairy` and `lactose` both give
   * `milk`, `contains_gluten` gives `gluten`.
   *
   * This is the alias table's whole output, and it is why the spelling tests are
   * not vacuous: `kind` alone would let `dairy` and `milk` agree by both being
   * unrecognised warnings. Unresolved input keeps its normalised form.
   */
  canonical: string;
}

export function getAllergenInfo(allergen: string): AllergenInfo {
  const normalised = allergen
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  // `contains_gluten` and `gluten` are the same substance — strip the prefix so
  // one table covers both spellings.
  const bare = normalised.replace(/^(contains|may_contain|contains_traces_of)_/, '');
  const canonical = ALLERGEN_ALIASES[bare] ?? bare;

  if (DIETARY_CLAIMS.has(canonical)) {
    return { kind: 'claim', canonical };
  }
  if (EU14_SUBSTANCES.has(canonical)) {
    return { kind: 'substance', canonical };
  }
  // A "contains …" of something not in either list is still a warning. Matched on
  // the substring rather than the prefix above so that spellings the prefix regex
  // misses (`may_contain_traces_of_x`) still warn instead of reading as unknown.
  if (normalised.includes('contain')) {
    return { kind: 'substance', canonical };
  }

  return { kind: 'unknown', canonical };
}

// Export the available allergens for form components
export const AVAILABLE_ALLERGENS = [
  'vegan',
  'vegetarian',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'halal',
  'kosher',
  'contains_nuts',
  'contains_dairy',
  'contains_gluten',
  'contains_soy',
  'contains_eggs',
  'spicy',
  'sugar_free',
  'organic',
  'low_sodium',
];
