'use client';

import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, getLanguageName, type LanguageCode } from '@/config/languageConfig';
import type { CategoryFormInputValues } from './categoryFormSchema';
import type { CategoryTranslations } from '@/types/categoryTranslations';
import styles from './CategoryTranslationsFields.module.css';

interface CategoryTranslationsFieldsProps {
  control: Control<CategoryFormInputValues>;
  register: UseFormRegister<CategoryFormInputValues>;
  errors: FieldErrors<CategoryFormInputValues>;
  initialTranslations?: CategoryTranslations;
  initialSourceLocale?: string | null;
  createMode?: boolean;
}

function firstEditableLocale(translations: CategoryTranslations, sourceLocale?: string | null): LanguageCode {
  return (
    LANGUAGE_CODES.find((locale) => locale !== sourceLocale && Boolean(translations[locale])) ??
    LANGUAGE_CODES.find((locale) => locale !== sourceLocale) ??
    LANGUAGE_CODES[0]
  );
}

export default function CategoryTranslationsFields({
  control,
  register,
  errors,
  initialTranslations = {},
  initialSourceLocale,
  createMode = false,
}: CategoryTranslationsFieldsProps) {
  const { t } = useTranslation();
  const sourceLocale = useWatch({ control, name: 'sourceLocale' });
  const [targetLocale, setTargetLocale] = useState<LanguageCode>(() =>
    firstEditableLocale(initialTranslations, initialSourceLocale),
  );
  const availableTargetLocales = LANGUAGE_CODES.filter((locale) => locale !== sourceLocale);
  const selectedTargetLocale = availableTargetLocales.includes(targetLocale)
    ? targetLocale
    : (availableTargetLocales[0] ?? LANGUAGE_CODES[0]);
  const namePath = `translations.${selectedTargetLocale}.name` as const;
  const descriptionPath = `translations.${selectedTargetLocale}.description` as const;
  const sourceLocaleError = errors.sourceLocale?.message;
  const sourceLocaleField = register('sourceLocale', {
    setValueAs: (value: string) => (value === '' ? null : value),
  });

  const handleSourceLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    sourceLocaleField.onChange(event);
    const nextSourceLocale = event.target.value;
    const nextTargetLocales = LANGUAGE_CODES.filter((locale) => locale !== nextSourceLocale);
    setTargetLocale((current) =>
      nextTargetLocales.includes(current) ? current : (nextTargetLocales[0] ?? LANGUAGE_CODES[0]),
    );
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('editor_tab_translations')}</legend>
      <FormField
        label={t('catalogue_source_language')}
        error={createMode && sourceLocaleError ? t(sourceLocaleError) : undefined}
      >
        <select {...sourceLocaleField} onChange={handleSourceLocaleChange}>
          <option value="">{t('catalogue_origin_unknown')}</option>
          {LANGUAGE_CODES.map((locale) => (
            <option key={locale} value={locale}>
              {getLanguageName(locale)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={t('editor_translations_target_languages')}>
        <select value={selectedTargetLocale} onChange={(event) => setTargetLocale(event.target.value as LanguageCode)}>
          {availableTargetLocales.map((locale) => (
            <option key={locale} value={locale}>
              {getLanguageName(locale)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={t('editor_translations_target_field', {
          field: t('category_name'),
          language: getLanguageName(selectedTargetLocale),
        })}
        error={errors.translations?.[selectedTargetLocale]?.name?.message}
      >
        <input {...register(namePath)} />
      </FormField>
      <FormField
        label={t('editor_translations_target_field', {
          field: t('description'),
          language: getLanguageName(selectedTargetLocale),
        })}
        error={errors.translations?.[selectedTargetLocale]?.description?.message}
      >
        <textarea {...register(descriptionPath)} />
      </FormField>
    </fieldset>
  );
}
