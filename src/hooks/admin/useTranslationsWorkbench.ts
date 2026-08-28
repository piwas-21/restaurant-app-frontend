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

export interface CopyResult {
  /** How many empty target fields were filled. Zero is a stateable outcome, not a no-op. */
  readonly filled: number;
  /** Bumped on every run so an unchanged count still re-announces. */
  readonly at: number;
}

/**
 * The Translations workbench's state and its three write paths
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN D2, slice S4).
 *
 * One locale switcher retargets product **and** variation **and** ingredient strings, and the three
 * places those live could hardly be less alike: the product keeps an ARRAY of rows inside
 * react-hook-form, a variation keeps a keyed MAP inside react-hook-form, and an ingredient is not
 * in react-hook-form at all — it is plain `useState` behind `changeIngredients`. Hiding that
 * behind one `setTranslation(ref, locale, value)` is the whole job of this hook, and the reason the
 * workbench component can stay a rendering of `TranslationSlot`s.
 *
 * `useWatch` and not `form.watch()`: the editor is a ~150-control page and a bare `watch()` would
 * re-render every one of them on each keystroke typed here. This subscribes to four names and
 * re-renders the panel alone.
 */
export function useTranslationsWorkbench(editor: Editor) {
  const { form, detailedIngredients, changeIngredients } = editor;
  const { control, getValues, setValue } = form;

  const watched = useWatch({ control, name: ['name', 'description', 'content', 'variations'] }) as [
    string | undefined,
    string | undefined,
    ProductContentRow[] | undefined,
    TranslatableVariation[] | undefined,
  ];
  const [name, description, content, variations] = watched;

  const slots = useMemo(
    () =>
      buildTranslationSlots({
        name,
        description,
        content,
        variations,
        ingredients: detailedIngredients,
      }),
    [name, description, content, variations, detailedIngredients],
  );

  const progress: Record<string, LocaleProgress> = useMemo(() => everyLocaleProgress(slots), [slots]);

  /**
   * Open on the first locale that still needs work, so the admin lands on the job rather than on a
   * finished one. Resolved ONCE, in the initialiser: recomputing it would move the selection out
   * from under someone the moment they finished a language.
   */
  const [targetLocale, setTargetLocale] = useState<string>(
    () => LANGUAGE_CODES.find((locale) => !isLocaleComplete(localeProgress(slots, locale))) ?? LANGUAGE_CODES[0],
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
      changeIngredients(
        detailedIngredients.map((ingredient, index) =>
          index === ref.index ? withIngredientTranslation(ingredient, locale, value) : ingredient,
        ),
      );
    },
    [changeIngredients, detailedIngredients, getValues, setValue],
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
    let filled = 0;

    for (const slot of slots) {
      const source = sourceTextFor(slot);
      if (isBlank(source) || !isBlank(translationIn(slot, targetLocale))) continue;
      filled += 1;

      if (slot.ref.target === 'item') {
        rows = nextProductContent(rows, targetLocale, slot.ref.field, source);
      } else if (slot.ref.target === 'variation') {
        const path = `variations.${slot.ref.index}.content.${targetLocale}.${slot.ref.field}`;
        setValue(path as keyof FieldValues, source, { shouldDirty: true });
      } else {
        const at = slot.ref.index;
        ingredients = ingredients.map((ingredient, index) =>
          index === at ? withIngredientTranslation(ingredient, targetLocale, source) : ingredient,
        );
      }
    }

    if (filled > 0) {
      setValue('content', rows, { shouldDirty: true });
      if (ingredients !== detailedIngredients) changeIngredients(ingredients);
    }
    setLastCopy({ filled, at: Date.now() });
  }, [changeIngredients, detailedIngredients, getValues, setValue, slots, sourceTextFor, targetLocale]);

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
