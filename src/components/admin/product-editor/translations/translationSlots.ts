import { LANGUAGE_CODES } from '@/config/languageConfig';
import { resolveIngredientKind } from '@/utils/ingredientKind';

/**
 * What there is to translate on a menu item, as one flat list — the model behind the Translations
 * workbench (MENU-ITEM-EDITOR-REDESIGN-PLAN D2, slice S4).
 *
 * The editor used to carry THREE translation UIs for one concept: a per-language row list for the
 * product, a `<details>` grid on every variation, and a second `<details>` grid on every
 * ingredient. They disagreed about everything — which locales exist, whether a description can be
 * translated, and what "done" means — because each of them read a different corner of the form.
 * This module is the single answer: it flattens all three corners into `TranslationSlot`s, and the
 * workbench renders one locale switcher over that list.
 *
 * It is deliberately PURE and structural. It imports no form library and no component; it takes
 * plain values and hands back plain values, so the completeness arithmetic — the part a reader is
 * most likely to doubt — is unit-testable without rendering anything.
 */

/** Where a slot's text lives in the editor's state. The workbench's writer dispatches on this. */
export type TranslationSlotRef =
  | { readonly target: 'item'; readonly field: 'name' | 'description' }
  | { readonly target: 'variation'; readonly index: number; readonly field: 'name' | 'description' }
  | { readonly target: 'ingredient'; readonly index: number };

/**
 * The four headings the grid groups rows under — the SAME four the Item tab names.
 *
 * `sauces` is separate from `ingredients` although both live in one `detailedIngredients` array,
 * and that is not cosmetic. #588 split that array into two named sections on the Item tab while
 * keeping one store behind them; a workbench that flattened them back into one heading would file
 * every sauce under "Ingredients" and send the admin to a section it is not in. The rebase that
 * merged #588 produced NO conflict here and a green build — a slot's `ref` still addresses the one
 * array by index, so nothing failed to compile and nothing wrote to the wrong row. Only the LABEL
 * was wrong, which no type can catch.
 */
export type TranslationGroupId = 'item' | 'variations' | 'ingredients' | 'sauces';

/**
 * Which i18n key names the field, so a row can state what it is to a screen reader.
 *
 * Four of the five are keys this repo ALREADY ships in all ten locales. Minting
 * `editor_translations_field_variation_name` beside the existing `variation_name` would have let one
 * screen call a variation something no other screen calls it, in nine languages, with nothing to
 * catch it — the locale gate compares bundles to each other, not meanings.
 */
export type TranslationFieldLabel =
  | 'item_name'
  | 'editor_translations_field_item_description'
  | 'variation_name'
  | 'variation_description'
  | 'editor_translations_field_ingredient_name';

export interface TranslationSlot {
  /** Unique and STABLE per row — it keys the React element, so the caret survives a re-render. */
  readonly key: string;
  readonly group: TranslationGroupId;
  readonly ref: TranslationSlotRef;
  readonly fieldLabel: TranslationFieldLabel;
  /** A description gets a textarea, a name an input. */
  readonly multiline: boolean;
  /** The item's own text — the source of record, in no declared language. */
  readonly source: string;
  /** Text already written for a locale, by locale code. Absent and blank are the same thing. */
  readonly translations: Readonly<Record<string, string>>;
}

/** One language's entry in a nested `content` map, as both variations and ingredients store it. */
interface NestedTranslation {
  readonly name?: string | null;
  readonly description?: string | null;
}

type NestedContent = Readonly<Record<string, NestedTranslation | null | undefined>>;

/** The product's own translations are an ARRAY of rows, not a map — the shape `contentSchema` takes. */
export interface ProductContentRow {
  readonly language?: string | null;
  readonly name?: string | null;
  readonly description?: string | null;
}

export interface TranslatableVariation {
  readonly name?: string | null;
  readonly description?: string | null;
  readonly content?: NestedContent | null;
}

export interface TranslatableIngredient {
  readonly name?: string | null;
  /** Absent means `'ingredient'` — `resolveIngredientKind` owns that default, not this module. */
  readonly kind?: string | null;
  readonly content?: NestedContent | null;
}

export interface TranslatableItem {
  readonly name?: string | null;
  readonly description?: string | null;
  readonly content?: readonly ProductContentRow[] | null;
  readonly variations?: readonly TranslatableVariation[] | null;
  readonly ingredients?: readonly TranslatableIngredient[] | null;
}

const text = (value: string | null | undefined): string => value ?? '';

export const isBlank = (value: string | null | undefined): boolean => text(value).trim().length === 0;

/**
 * Keep only the locales that really carry text. A blank entry is not a translation, and counting
 * one as present is how a "complete" badge starts lying — which is exactly what the three old UIs
 * did, one of them by SEEDING blank entries for seven of the ten locales on every new ingredient.
 */
const filled = (entries: readonly (readonly [string, string | null | undefined])[]): Record<string, string> =>
  Object.fromEntries(entries.filter(([, value]) => !isBlank(value)).map(([locale, value]) => [locale, text(value)]));

const fromNested = (content: NestedContent | null | undefined, field: 'name' | 'description'): Record<string, string> =>
  filled(Object.entries(content ?? {}).map(([locale, entry]) => [locale, entry?.[field]] as const));

const fromRows = (
  rows: readonly ProductContentRow[] | null | undefined,
  field: 'name' | 'description',
): Record<string, string> =>
  filled((rows ?? []).filter((row) => !isBlank(row.language)).map((row) => [text(row.language), row[field]] as const));

/**
 * A slot exists when there is a source string to translate **or** when a locale already holds text
 * for it. The second half is not defensive padding: clearing an item's description would otherwise
 * make ten existing translations of it disappear from the only screen that can edit them, while the
 * PUT went on sending them. A row that cannot be seen is a row that cannot be corrected.
 */
const slotOrNothing = (slot: TranslationSlot): TranslationSlot[] =>
  isBlank(slot.source) && Object.keys(slot.translations).length === 0 ? [] : [slot];

export function buildTranslationSlots(item: TranslatableItem): TranslationSlot[] {
  const itemSlots: TranslationSlot[] = [
    ...slotOrNothing({
      key: 'item-name',
      group: 'item',
      ref: { target: 'item', field: 'name' },
      fieldLabel: 'item_name',
      multiline: false,
      source: text(item.name),
      translations: fromRows(item.content, 'name'),
    }),
    ...slotOrNothing({
      key: 'item-description',
      group: 'item',
      ref: { target: 'item', field: 'description' },
      fieldLabel: 'editor_translations_field_item_description',
      multiline: true,
      source: text(item.description),
      translations: fromRows(item.content, 'description'),
    }),
  ];

  const variationSlots = (item.variations ?? []).flatMap((variation, index) => [
    ...slotOrNothing({
      key: `variation-${index}-name`,
      group: 'variations',
      ref: { target: 'variation', index, field: 'name' },
      fieldLabel: 'variation_name',
      multiline: false,
      source: text(variation.name),
      translations: fromNested(variation.content, 'name'),
    }),
    ...slotOrNothing({
      key: `variation-${index}-description`,
      group: 'variations',
      ref: { target: 'variation', index, field: 'description' },
      fieldLabel: 'variation_description',
      multiline: false,
      source: text(variation.description),
      translations: fromNested(variation.content, 'description'),
    }),
  ]);

  /**
   * `index` is the row's position in the WHOLE `detailedIngredients` array, never within its group.
   * That is what the writer dispatches on, so the two must not diverge: grouping is a rendering
   * concern here and an addressing concern nowhere.
   */
  const ingredientSlots = (item.ingredients ?? []).flatMap((ingredient, index) =>
    slotOrNothing({
      key: `ingredient-${index}-name`,
      group: resolveIngredientKind(ingredient) === 'sauce' ? 'sauces' : 'ingredients',
      ref: { target: 'ingredient', index },
      fieldLabel: 'editor_translations_field_ingredient_name',
      multiline: false,
      source: text(ingredient.name),
      translations: fromNested(ingredient.content, 'name'),
    }),
  );

  return [...itemSlots, ...variationSlots, ...ingredientSlots];
}

export const translationIn = (slot: TranslationSlot, locale: string): string => slot.translations[locale] ?? '';

export interface LocaleProgress {
  readonly done: number;
  readonly total: number;
}

/**
 * How much of one locale is written. The denominator is the SLOT count, so it is the same for every
 * locale and moves only when the item itself gains or loses text — which is what makes the ten
 * counters in the rail comparable at a glance.
 */
export function localeProgress(slots: readonly TranslationSlot[], locale: string): LocaleProgress {
  return {
    done: slots.filter((slot) => !isBlank(translationIn(slot, locale))).length,
    total: slots.length,
  };
}

export const isLocaleComplete = ({ done, total }: LocaleProgress): boolean => total > 0 && done === total;

export function everyLocaleProgress(slots: readonly TranslationSlot[]): Record<string, LocaleProgress> {
  return Object.fromEntries(LANGUAGE_CODES.map((locale) => [locale, localeProgress(slots, locale)]));
}
