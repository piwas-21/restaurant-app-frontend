'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/languageConfig';
import type { useOptionSetEditor } from '@/hooks/admin/useOptionSetEditor';
import type { useOptionSetTranslationReview } from '@/hooks/admin/useOptionSetTranslationReview';
import TranslationSuggestionsReview from '../product-editor/translations/TranslationSuggestionsReview';
import styles from './OptionSetEditorWorkspace.module.css';

interface Props {
  readonly editor: ReturnType<typeof useOptionSetEditor>;
  readonly review: ReturnType<typeof useOptionSetTranslationReview>;
  readonly onReviewToggle: (open: boolean) => void;
}

export default function OptionSetTranslationsPanel({ editor, review, onReviewToggle }: Props) {
  const { t } = useTranslation();
  return (
    <details className={styles.translations}>
      <summary>{t('option_set_translations')}</summary>
      <p className={styles.notice}>{t('option_set_translations_help')}</p>
      <FormField label={t('option_set_source_locale')}>
        <select
          value={editor.sourceLocale}
          onChange={(event) => editor.setSourceLocale(event.target.value as LanguageCode)}
          required
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeName}
            </option>
          ))}
        </select>
      </FormField>
      {LANGUAGE_CODES.filter((locale) => locale !== editor.sourceLocale).map((locale) => {
        const language = SUPPORTED_LANGUAGES.find((row) => row.code === locale);
        return (
          <FormField
            key={locale}
            label={t('option_set_translation_locale', { language: language?.nativeName ?? locale })}
          >
            <input
              value={editor.translations[locale] ?? ''}
              maxLength={200}
              onChange={(event) => {
                review.clearAcceptedSuggestionIds();
                editor.setTranslation(locale, event.target.value);
              }}
            />
          </FormField>
        );
      })}
      <details onToggle={(event) => onReviewToggle(event.currentTarget.open)}>
        <summary>{t('translation_review_title')}</summary>
        <TranslationSuggestionsReview review={review} showSourceLocaleChoices={false} />
      </details>
    </details>
  );
}
