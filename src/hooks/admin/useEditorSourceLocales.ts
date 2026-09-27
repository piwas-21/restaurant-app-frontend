'use client';

import { useCallback, useState } from 'react';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { useProductEditorForm } from './useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { TranslationSlot } from '@/components/admin/product-editor/translations/translationSlots';
import { isPersistedMenuId } from '@/utils/menuSectionDraft';

type Editor = ReturnType<typeof useProductEditorForm>;

function persistedSourceLocale(product: ProductDetails, slot: TranslationSlot): string | undefined {
  const fieldKey = slot.ref.target === 'ingredient' ? 'name' : slot.ref.field;
  if (slot.ref.target === 'item') return product.translationMetadata?.sourceLocales?.[fieldKey];
  if (slot.ref.target === 'variation')
    return product.variations[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
  if (slot.ref.target === 'ingredient')
    return product.detailedIngredients?.[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
  return product.menuDefinition?.sections[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
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
  const editorForm = editor.form;
  const editorIngredients = editor.detailedIngredients;
  const editorMenuDefinition = editor.menuDefinition;

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
      if (slot.ref.target === 'item') return false;
      if (slot.ref.target === 'variation') {
        const rows = editorForm.getValues('variations') as Array<{ id?: string }> | undefined;
        return !isPersistedMenuId(rows?.[slot.ref.index]?.id);
      }
      if (slot.ref.target === 'ingredient') return !isPersistedMenuId(editorIngredients[slot.ref.index]?.id);
      return !isPersistedMenuId(editorMenuDefinition.sections[slot.ref.index]?.id);
    },
    [editorForm, editorIngredients, editorMenuDefinition.sections, product, productId, sourceLocales],
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
