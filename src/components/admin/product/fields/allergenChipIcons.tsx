import {
  Bean,
  CandyOff,
  Egg,
  Flame,
  Gauge,
  Leaf,
  Milk,
  MilkOff,
  Moon,
  Nut,
  NutOff,
  Salad,
  Sprout,
  Star,
  Wheat,
  WheatOff,
  type LucideIcon,
} from 'lucide-react';

/**
 * One monochrome glyph per chip of the ADMIN allergen picker (conformance review G13,
 * frontend #581).
 *
 * ### Why this is not in `lib/allergens.ts`, and why that is not a loophole
 *
 * `lib/allergens.ts` deliberately carries **no icon per entry**: MENU-DESIGN-CONFORMANCE-PLAN **D9**
 * stripped 25 emoji and 13 colour classes from it because *"zero of the 28 classic design screens
 * contain an emoji"* and the guest design system permits one chip treatment. That decision is about
 * the **guest menu**, which is not touched here and must not be.
 *
 * The admin editor is a different surface with its own approved screen, and
 * `recipe_dietary_details_margherita_pizza` draws a distinct glyph on every chip — it is how the
 * admin scans sixteen chips without reading sixteen words. So the map lives at the one admin render
 * site that needs it, beside the component that consumes it, and the shared vocabulary stays data.
 *
 * **If a second surface ever wants these, that is a D9 conversation, not an import.** Moving this
 * file up into `lib/` would re-create exactly the per-entry icon table D9 deleted.
 *
 * Every glyph is a lucide outline icon, monochrome and coloured by CSS, so it inherits the chip's
 * selected/unselected state instead of carrying a colour of its own.
 */
export const ALLERGEN_CHIP_ICONS: Readonly<Record<string, LucideIcon>> = {
  // Dietary CLAIMS — a selling point.
  vegan: Leaf,
  vegetarian: Salad,
  organic: Sprout,
  gluten_free: WheatOff,
  dairy_free: MilkOff,
  nut_free: NutOff,
  sugar_free: CandyOff,
  low_sodium: Gauge,
  halal: Moon,
  kosher: Star,
  // "Contains" WARNINGS — the substance itself, so the glyph is the food, not a negation.
  contains_gluten: Wheat,
  contains_dairy: Milk,
  contains_nuts: Nut,
  contains_soy: Bean,
  contains_eggs: Egg,
  spicy: Flame,
};

/** The `None` chip's own glyph — a negation, because it is the absence of every chip above. */
export { CircleOff as ALLERGEN_NONE_ICON } from 'lucide-react';
