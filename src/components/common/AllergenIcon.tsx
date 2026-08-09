'use client';

import React from 'react';
import {
  BadgeCheck,
  Bean,
  Carrot,
  Droplet,
  Egg,
  Fish,
  Flame,
  Flower2,
  Grip,
  Info,
  Leaf,
  Milk,
  MilkOff,
  Nut,
  NutOff,
  Salad,
  ShieldCheck,
  Shrimp,
  Snail,
  Sprout,
  TrendingDown,
  TriangleAlert,
  Vegan,
  Wheat,
  WheatOff,
  Wine,
  CandyOff,
  type LucideIcon,
} from 'lucide-react';
import { getAllergenInfo } from '@/lib/allergens';

/**
 * One glyph per allergen, keyed on the CANONICAL token `getAllergenInfo` resolves to — so `dairy`,
 * `lactose` and `milk` all draw the same carton, and `contains_gluten` draws the same ear of wheat
 * as `gluten`.
 *
 * This supersedes D9, which collapsed every substance onto a single `AlertTriangle` on the grounds
 * that "zero of the 28 classic design screens contain an emoji". That reasoning was right about
 * EMOJI and wrong about icons: one triangle repeated four times on a card tells a guest there are
 * four warnings but not what any of them is, which is the opposite of what an allergen line is for.
 * These are monochrome line icons from the same lucide set the rest of the app uses, sized in `em`
 * against the chip's own text, so they carry information without adding a second colour family —
 * which is the part of D9 that still stands.
 *
 * The table lives at the RENDER site rather than in `src/lib/allergens.ts`: that module is the data
 * vocabulary (which tokens exist, which spellings alias to which), it is what the spelling tests
 * pin, and it deliberately holds no presentation. Adding a JSX import there would drag React into a
 * pure lookup used by non-React callers.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  // ── the EU-14 substances: a "contains" warning ──
  gluten: Wheat,
  crustaceans: Shrimp,
  eggs: Egg,
  fish: Fish,
  peanuts: Bean,
  soy: Sprout,
  milk: Milk,
  nuts: Nut,
  celery: Carrot,
  mustard: Droplet,
  sesame: Grip,
  sulphites: Wine,
  lupin: Flower2,
  molluscs: Snail,

  // ── dietary claims: a selling point ──
  vegan: Vegan,
  vegetarian: Salad,
  gluten_free: WheatOff,
  dairy_free: MilkOff,
  nut_free: NutOff,
  halal: BadgeCheck,
  kosher: ShieldCheck,
  sugar_free: CandyOff,
  organic: Leaf,
  low_sodium: TrendingDown,
  spicy: Flame,
};

/**
 * The glyph for one allergen token, or `null` when the caller should render none.
 *
 * A token in neither vocabulary still gets an icon rather than nothing: an unrecognised
 * "contains …" is a warning (`TriangleAlert`), and anything else is neutral (`Info`). That matters
 * because the `icons` chip variant has no visible text to fall back on — a chip with no glyph would
 * be an empty box.
 */
export function allergenIconFor(allergen: string): LucideIcon | null {
  const { kind, canonical } = getAllergenInfo(allergen);
  return ICONS[canonical] ?? (kind === 'substance' ? TriangleAlert : Info);
}

interface AllergenIconProps {
  allergen: string;
  className?: string;
}

/**
 * `aria-hidden` in every variant: the chip beside it carries the word, and the icon-only variant
 * carries a visually-hidden label plus a `title`. An icon that announced itself would be a second,
 * vaguer copy of a name the guest already has.
 */
export default function AllergenIcon({ allergen, className }: Readonly<AllergenIconProps>) {
  const Icon = allergenIconFor(allergen);
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}
