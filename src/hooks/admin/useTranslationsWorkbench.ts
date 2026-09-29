'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWatch, type FieldValues } from 'react-hook-form';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { useProductEditorForm } from './useProductEditorForm';
import {
  buildTranslationSlots,
  everyLocaleProgress,
  isBlank,
  isLocaleComplete,
  localeProgress,
  translationIn,
  withVariationClientKeys,
  type LocaleProgress,
  type ProductContentRow,
  type TranslatableVariation,
  type TranslationSlot,
  type TranslationSlotRef,
} from '@/components/admin/product-editor/translations/translationSlots';
import {
  nextProductContent,
  withIngredientTranslation,
} from '@/components/admin/product-editor/translations/translationWrites';

/** "Show the item's own text", the source of record — which carries no declared language. */
export const TRANSLATION_SOURCE_BASE = '';

type Editor = ReturnType<typeof useProductEditorForm>;
const WATCHED_FIELDS = ['name', 'description', 'content', 'variations'] as const;

export interface CopyResult {
  /** How many empty target fields were filled. Zero is a stateable outcome, not a no-op. */
  readonly filled: number;
  /** Bumped on every run so an unchanged count still re-announces. */
  readonly at: number;
}

type WatchedTranslationValues = [string?, string?, ProductContentRow[]?, TranslatableVariation[]?];

/**
 * One locale switcher writes item rows, variation maps, menu sections and ingredient state through
 * a single setTranslation path.
 *
 * `useWatch` and not `form.watch()`: the editor is a ~150-control page and a bare `watch()` would
 * re-render every one of them on each keystroke typed here. This subscribes to four names and
 * re-renders the panel alone.
 */
export function useTranslationsWorkbench(
  editor: Editor,
  knownSourceLocaleFor?: (slot: TranslationSlot) => string | undefined,
) {
  const { form, detailedIngredients, changeIngredients, variations: variationFieldArray, menuDefinition } = editor;
  const { control, getValues, setValue } = form;

  const watched = useWatch({ control, name: WATCHED_FIELDS }) as WatchedTranslationValues;

  const slots = useMemo(
    () =>
      buildTranslationSlots({
        name: watched[0],
        description: watched[1],
        content: watched[2],
        variations: withVariationClientKeys(watched[3], variationFieldArray.fields),
        ingredients: detailedIngredients,
        sections: menuDefinition.sections,
      }),
    [watched, variationFieldArray.fields, detailedIngredients, menuDefinition.sections],
  );

  const progress: Record<string, LocaleProgress> = useMemo(
    () => everyLocaleProgress(slots, knownSourceLocaleFor),
    [slots, knownSourceLocaleFor],
  );

  /**
   * Open on the first locale that still needs work, so the admin lands on the job rather than on a
   * finished one. Resolved ONCE, in the initialiser: recomputing it would move the selection out
   * from under someone the moment they finished a language.
   */
  const [targetLocale, setTargetLocale] = useState<string>(
    () =>
      LANGUAGE_CODES.find((locale) => !isLocaleComplete(localeProgress(slots, locale, knownSourceLocaleFor))) ??
      LANGUAGE_CODES[0],
  );
  const [sourceLocale, setSourceLocale] = useState<string>(TRANSLATION_SOURCE_BASE);
  const [lastCopy, setLastCopy] = useState<CopyResult | null>(null);

  const sourceTextFor = useCallback(
    (slot: TranslationSlot) =>
      sourceLocale === TRANSLATION_SOURCE_BASE ? slot.source : translationIn(slot, sourceLocale),
    [sourceLocale],
  );

  const setTranslation = useCallback(
    (ref: TranslationSlotRef, locale: string, value: string) => {
      if (ref.target === 'item') {
        const rows = (getValues('content') ?? []) as ProductContentRow[];
        setValue('content', nextProductContent(rows, locale, ref.field, value), { shouldDirty: true });
        return;
      }
      if (ref.target === 'variation') {
        setValue(`variations.${ref.index}.content.${locale}.${ref.field}` as keyof FieldValues, value, {
          shouldDirty: true,
        });
        return;
      }
      if (ref.target === 'menuSection') {
        const sections = editor.menuDefinition.sections.map((section, index) => {
          if (index !== ref.index) return section;
          const previous = section.translations?.[locale] ?? { name: '', description: '' };
          return {
            ...section,
            translations: {
              ...section.translations,
              [locale]: { ...previous, [ref.field]: value },
            },
          };
        });
        editor.changeMenuDefinition({ ...editor.menuDefinition, sections });
        return;
      }
      changeIngredients(
        detailedIngredients.map((ingredient, index) =>
          index === ref.index ? withIngredientTranslation(ingredient, locale, value) : ingredient,
        ),
      );
    },
    [changeIngredients, detailedIngredients, editor, getValues, setValue],
  );

  /**
   * Fill every EMPTY target field from the source column, and say how many were filled.
   *
   * The two batched writes are why this is not a loop over `setTranslation`: the product's rows and
   * the ingredient list are each rebuilt whole, so calling the single-field writer per slot would
   * read stale state between iterations and keep only the last change of each.
   */
  const copySourceToEmpty = useCallback(() => {
    let rows = (getValues('content') ?? []) as ProductContentRow[];
    let ingredients = detailedIngredients;
    let sections = editor.menuDefinition.sections;
    let filled = 0;

    for (const slot of slots) {
      const source = sourceTextFor(slot);
      if (isBlank(source) || !isBlank(translationIn(slot, targetLocale))) continue;
      filled += 1;
      const ref = slot.ref;

      if (ref.target === 'item') {
        rows = nextProductContent(rows, targetLocale, ref.field, source);
      } else if (ref.target === 'variation') {
        const path = `variations.${ref.index}.content.${targetLocale}.${ref.field}`;
        setValue(path as keyof FieldValues, source, { shouldDirty: true });
      } else if (ref.target === 'menuSection') {
        sections = sections.map((section, index) => {
          if (index !== ref.index) return section;
          const previous = section.translations?.[targetLocale] ?? { name: '', description: '' };
          return {
            ...section,
            translations: {
              ...section.translations,
              [targetLocale]: { ...previous, [ref.field]: source },
            },
          };
        });
      } else {
        const at = ref.index;
        ingredients = ingredients.map((ingredient, index) =>
          index === at ? withIngredientTranslation(ingredient, targetLocale, source) : ingredient,
        );
      }
    }

    if (filled > 0) {
      setValue('content', rows, { shouldDirty: true });
      if (ingredients !== detailedIngredients) changeIngredients(ingredients);
      if (sections !== editor.menuDefinition.sections) {
        editor.changeMenuDefinition({ ...editor.menuDefinition, sections });
      }
    }
    setLastCopy({ filled, at: Date.now() });
  }, [changeIngredients, detailedIngredients, editor, getValues, setValue, slots, sourceTextFor, targetLocale]);

  return {
    slots,
    progress,
    targetLocale,
    setTargetLocale,
    sourceLocale,
    setSourceLocale,
    sourceTextFor,
    setTranslation,
    copySourceToEmpty,
    lastCopy,
    missing: slots.length - (progress[targetLocale]?.done ?? 0),
  };
}
