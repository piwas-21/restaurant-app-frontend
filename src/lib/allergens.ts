/**
 * Allergen vocabulary — the single lookup shared by the menu cards, the item
 * sheet and the admin product editor. A pure table + resolver, deliberately out
 * of the component file: it is data, it is what the tests pin, and both templates
 * read it (so a miss here shows up on every menu in every skin).
 *
 * Icon + style per allergen token. Two vocabularies live here on purpose:
 *
 * 1. **Dietary claims** (`vegan`, `gluten_free`, `halal`, …) — the values the
 *    admin form offers via {@link AVAILABLE_ALLERGENS}.
 * 2. **Bare substance names** (`gluten`, `milk`, `nuts`, `sesame`, …) — the EU-14
 *    allergen list, which is how a real menu is actually written and what tenants
 *    type in. These were missing, so *every* substance name fell through to the
 *    generic 🏷️ label: on the demo menu all four distinct allergens rendered the
 *    same fallback icon. A substance is a "contains" warning, so it takes the
 *    warning style; `_free` claims keep their own.
 */
const ALLERGEN_STYLES: { [key: string]: { icon: string; className: string } } = {
  // dietary claims
  vegan: { icon: '🌱', className: 'vegan' },
  vegetarian: { icon: '🥬', className: 'vegetarian' },
  gluten_free: { icon: '🚫🌾', className: 'glutenFree' },
  dairy_free: { icon: '🚫🥛', className: 'dairyFree' },
  nut_free: { icon: '🚫🥜', className: 'nutFree' },
  halal: { icon: '☪️', className: 'halal' },
  kosher: { icon: '✡️', className: 'kosher' },
  spicy: { icon: '🌶️', className: 'spicy' },
  sugar_free: { icon: '🚫🍬', className: 'sugarFree' },
  organic: { icon: '🌿', className: 'organic' },
  low_sodium: { icon: '🧂⬇️', className: 'lowSodium' },
  // the EU-14 substances, as bare names and as `contains_*`
  gluten: { icon: '🌾', className: 'warning' },
  crustaceans: { icon: '🦐', className: 'warning' },
  eggs: { icon: '🥚', className: 'warning' },
  fish: { icon: '🐟', className: 'warning' },
  peanuts: { icon: '🥜', className: 'warning' },
  soy: { icon: '🫘', className: 'warning' },
  milk: { icon: '🥛', className: 'warning' },
  nuts: { icon: '🌰', className: 'warning' },
  celery: { icon: '🥬', className: 'warning' },
  mustard: { icon: '🌭', className: 'warning' },
  sesame: { icon: '🫘', className: 'warning' },
  sulphites: { icon: '🍷', className: 'warning' },
  lupin: { icon: '🌼', className: 'warning' },
  molluscs: { icon: '🦪', className: 'warning' },
};

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

export function getAllergenInfo(allergen: string) {
  const allergenLower = allergen
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  // `contains_gluten` and `gluten` are the same substance — strip the prefix so
  // one table covers both spellings.
  const bare = allergenLower.replace(/^(contains|may_contain|contains_traces_of)_/, '');
  const canonical = ALLERGEN_ALIASES[bare] ?? bare;

  const match = ALLERGEN_STYLES[allergenLower] ?? ALLERGEN_STYLES[bare] ?? ALLERGEN_STYLES[canonical];
  if (match) {
    return match;
  }

  // A "contains …" of something not in the table is still a warning.
  if (allergenLower.includes('contain')) {
    return { icon: '⚠️', className: 'warning' };
  }

  // Default styling for unknown allergens
  return { icon: '🏷️', className: 'default' };
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
