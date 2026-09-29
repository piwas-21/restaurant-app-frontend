'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, getLanguageNativeName } from '@/config/languageConfig';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import styles from './TranslationBaseLanguagePrompt.module.css';

type Review = Pick<
  ReturnType<typeof useEditorTranslationReview>,
  'unknownSourceLocaleFields' | 'setSourceLocaleForMany' | 'sourceLocaleDirty'
>;

export default function TranslationBaseLanguagePrompt({ review }: { readonly review: Review }) {
  const { t } = useTranslation();
  const unknownKeys = review.unknownSourceLocaleFields.map((field) => field.slot.key);
  if (unknownKeys.length === 0 && !review.sourceLocaleDirty) return null;

  return (
    <section className={styles.prompt} aria-labelledby="translation-base-language-title">
      <h3 id="translation-base-language-title" className={styles.title}>
        {t('editor_translations_base_language_title')}
      </h3>
      {unknownKeys.length > 0 ? (
        <>
          <p id="translation-base-language-help" className={styles.help}>
            {t('editor_translations_base_language_help', { count: unknownKeys.length })}
          </p>
          <FormField label={t('editor_translations_base_language_label')} className={styles.field}>
            <select
              className={styles.select}
              value=""
              aria-describedby="translation-base-language-help"
              onChange={(event) => review.setSourceLocaleForMany(unknownKeys, event.target.value)}
            >
              <option value="">{t('translation_review_source_locale_required')}</option>
              {LANGUAGE_CODES.map((locale) => (
                <option key={locale} value={locale}>
                  {getLanguageNativeName(locale)}
                </option>
              ))}
            </select>
          </FormField>
        </>
      ) : (
        <output className={styles.help}>{t('editor_translations_base_language_save')}</output>
      )}
    </section>
  );
}
