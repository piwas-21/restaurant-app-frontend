'use client';

import { useCallback, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useWatch, type Control, type UseFormGetValues, type UseFormSetValue } from 'react-hook-form';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { CategoryTranslations } from '@/types/categoryTranslations';
import type { CategoryFormInputValues } from '@/components/admin/categoryFormSchema';
import type { ReviewedTextChange } from '@/components/admin/product-editor/translations/translationReviewFields';
import { useLocalizedOwnerTranslationReview } from './useLocalizedOwnerTranslationReview';

interface Options {
  readonly isOpen: boolean;
  readonly categoryId?: string;
  readonly expectedContentVersion?: string;
  readonly control: Control<CategoryFormInputValues>;
  readonly getValues: UseFormGetValues<CategoryFormInputValues>;
  readonly setValue: UseFormSetValue<CategoryFormInputValues>;
}

function textByLocale(
  translations: CategoryTranslations,
  field: 'name' | 'description',
): Partial<Record<LanguageCode, string | null | undefined>> {
  return Object.fromEntries(LANGUAGE_CODES.map((locale) => [locale, translations[locale]?.[field]])) as Partial<
    Record<LanguageCode, string | null | undefined>
  >;
}

export function useCategoryTranslationReview({
  isOpen,
  categoryId,
  expectedContentVersion,
  control,
  getValues,
  setValue,
}: Options) {
  const [panelOpen, setPanelOpen] = useState(false);
  const name = useWatch({ control, name: 'name' }) ?? '';
  const description = useWatch({ control, name: 'description' }) ?? '';
  const sourceLocale = useWatch({ control, name: 'sourceLocale' });
  const translationsValue = useWatch({ control, name: 'translations' });
  const translations = useMemo(() => translationsValue ?? {}, [translationsValue]);
  const fields = useMemo(
    () => [
      {
        fieldKey: 'name' as const,
        fieldLabel: 'category_name' as const,
        sourceText: name,
        translations: textByLocale(translations, 'name'),
      },
      {
        fieldKey: 'description' as const,
        fieldLabel: 'description' as const,
        sourceText: description,
        translations: textByLocale(translations, 'description'),
      },
    ],
    [description, name, translations],
  );
  const onApply = useCallback(
    (changes: readonly ReviewedTextChange[]) => {
      const existingTranslations = getValues('translations');
      let localized: CategoryTranslations = existingTranslations ? { ...existingTranslations } : {};
      for (const change of changes) {
        if (change.fieldRef.entityType !== 'category') continue;
        const current = localized[change.locale] ?? { name: '' };
        localized = {
          ...localized,
          [change.locale]: { ...current, [change.fieldRef.fieldKey]: change.text },
        };
      }
      setValue('translations', localized, { shouldDirty: true });
    },
    [getValues, setValue],
  );
  const review = useLocalizedOwnerTranslationReview({
    isOpen: isOpen && panelOpen,
    entityType: 'category',
    entityId: categoryId,
    clientKey: 'category:draft', // pragma: allowlist secret -- stable unsaved category identity
    sourceLocale,
    fields,
    expectedContentVersion,
    onApply,
  });

  return {
    review,
    panelOpen,
    onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => setPanelOpen(event.currentTarget.open),
  };
}
