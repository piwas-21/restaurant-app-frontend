'use client';

import { useCallback, useState } from 'react';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { useProductEditorForm } from './useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { TranslationSlot } from '@/components/admin/product-editor/translations/translationSlots';
import { isPersistedMenuId } from '@/utils/menuSectionDraft';

type Editor = ReturnType<typeof useProductEditorForm>;

function persistedSourceLocale(product: ProductDetails, slot: TranslationSlot): string | undefined {
  const ref = slot.ref;
  const fieldKey = ref.target === 'ingredient' ? 'name' : ref.field;
  if (ref.target === 'item') return product.translationMetadata?.sourceLocales?.[fieldKey];
  if (ref.target === 'variation') {
    if (!ref.variationId) return undefined;
    return product.variations.find((variation) => variation.id === ref.variationId)?.translationMetadata
      ?.sourceLocales?.[fieldKey];
  }
  if (ref.target === 'ingredient') {
    if (!ref.ingredientId) return undefined;
    return product.detailedIngredients?.find((ingredient) => ingredient.id === ref.ingredientId)?.translationMetadata
      ?.sourceLocales?.[fieldKey];
  }
  return product.menuDefinition?.sections[ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
}

const languageCode = (value: string): LanguageCode =>
  LANGUAGE_CODES.includes(value as LanguageCode) ? (value as LanguageCode) : 'en';

function hasLanguageCode(value: string | undefined): value is LanguageCode {
  return !!value && LANGUAGE_CODES.includes(value as LanguageCode);
}

interface Options {
  readonly editor: Editor;
  readonly product: ProductDetails;
  readonly productId: string;
}

export function useEditorSourceLocales({ editor, product, productId }: Options) {
  const [sourceLocales, setSourceLocales] = useState<Readonly<Record<string, LanguageCode>>>({});
  const defaultLocale = languageCode(editor.currentLanguage);
  const sourceLocaleFor = useCallback(
    (slotKey: string, slot?: TranslationSlot) =>
      sourceLocales[slotKey] ?? languageCode((slot && persistedSourceLocale(product, slot)) ?? defaultLocale),
    [defaultLocale, product, sourceLocales],
  );
  const sourceLocaleKnownFor = useCallback(
    (slotKey: string, slot?: TranslationSlot) => {
      if (!slot) return false;
      if (hasLanguageCode(sourceLocales[slotKey]) || hasLanguageCode(persistedSourceLocale(product, slot))) return true;
      if (!productId) return true;
      const ref = slot.ref;
      if (ref.target === 'item') return false;
      if (ref.target === 'variation') return !isPersistedMenuId(ref.variationId);
      if (ref.target === 'ingredient') return !isPersistedMenuId(ref.ingredientId);
      return !isPersistedMenuId(editor.menuDefinition.sections[ref.index]?.id);
    },
    [editor.menuDefinition.sections, product, productId, sourceLocales],
  );
  const setSourceLocaleFor = useCallback((slotKey: string, locale: string) => {
    setSourceLocales((current) => {
      if (locale) return { ...current, [slotKey]: languageCode(locale) };
      const next = { ...current };
      delete next[slotKey];
      return next;
    });
  }, []);

  return { sourceLocaleFor, sourceLocaleKnownFor, setSourceLocaleFor };
}
