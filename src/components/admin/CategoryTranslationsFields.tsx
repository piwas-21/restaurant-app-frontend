'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, getLanguageName, type LanguageCode } from '@/config/languageConfig';
import type { CategoryFormInputValues } from './categoryFormSchema';
import type { CategoryTranslations } from '@/types/categoryTranslations';
import styles from './CategoryTranslationsFields.module.css';

interface CategoryTranslationsFieldsProps {
  register: UseFormRegister<CategoryFormInputValues>;
  errors: FieldErrors<CategoryFormInputValues>;
  initialTranslations?: CategoryTranslations;
  initialSourceLocale?: string | null;
  createMode?: boolean;
}

function firstEditableLocale(translations: CategoryTranslations, sourceLocale?: string | null): LanguageCode {
  return (
    LANGUAGE_CODES.find((locale) => Boolean(translations[locale])) ??
    LANGUAGE_CODES.find((locale) => locale !== sourceLocale) ??
    LANGUAGE_CODES[0]
  );
}

export default function CategoryTranslationsFields({
  register,
  errors,
  initialTranslations = {},
  initialSourceLocale,
  createMode = false,
}: CategoryTranslationsFieldsProps) {
  const { t } = useTranslation();
  const [targetLocale, setTargetLocale] = useState<LanguageCode>(() =>
    firstEditableLocale(initialTranslations, initialSourceLocale),
  );
  const namePath = `translations.${targetLocale}.name` as const;
  const descriptionPath = `translations.${targetLocale}.description` as const;
  const sourceLocaleError = errors.sourceLocale?.message;

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('editor_tab_translations')}</legend>
      <FormField
        label={t('catalogue_source_language')}
        error={createMode && sourceLocaleError ? t(sourceLocaleError) : undefined}
      >
        <select
          {...register('sourceLocale', {
            setValueAs: (value: string) => (value === '' ? null : value),
          })}
        >
          <option value="">{t('catalogue_origin_unknown')}</option>
          {LANGUAGE_CODES.map((locale) => (
            <option key={locale} value={locale}>
              {getLanguageName(locale)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label={t('editor_translations_target_languages')}>
        <select value={targetLocale} onChange={(event) => setTargetLocale(event.target.value as LanguageCode)}>
          {LANGUAGE_CODES.map((locale) => (
            <option key={locale} value={locale}>
              {getLanguageName(locale)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={t('editor_translations_target_field', {
          field: t('category_name'),
          language: getLanguageName(targetLocale),
        })}
        error={errors.translations?.[targetLocale]?.name?.message}
      >
        <input {...register(namePath)} />
      </FormField>
      <FormField
        label={t('editor_translations_target_field', {
          field: t('description'),
          language: getLanguageName(targetLocale),
        })}
        error={errors.translations?.[targetLocale]?.description?.message}
      >
        <textarea {...register(descriptionPath)} />
      </FormField>
    </fieldset>
  );
}
