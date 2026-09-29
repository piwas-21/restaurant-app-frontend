'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, getLanguageNativeName } from '@/config/languageConfig';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import { isBlank, type TranslationSlot } from './translationSlots';
import styles from './TranslationBaseLanguagePrompt.module.css';

type Review = Pick<
  ReturnType<typeof useEditorTranslationReview>,
  'unknownSourceLocaleFields' | 'setSourceLocaleForMany' | 'sourceLocaleDirty'
>;

interface Props {
  readonly review: Review;
  readonly slots: readonly TranslationSlot[];
  readonly sourceLocaleFor: (slotKey: string, slot?: TranslationSlot) => string;
  readonly sourceLocaleKnownFor: (slotKey: string, slot?: TranslationSlot) => boolean;
  readonly onSourceLocaleChange: (slotKey: string, locale: string) => void;
}

export default function TranslationBaseLanguagePrompt({
  review,
  slots,
  sourceLocaleFor,
  sourceLocaleKnownFor,
  onSourceLocaleChange,
}: Props) {
  const { t } = useTranslation();
  const unknownKeys = review.unknownSourceLocaleFields.map((field) => field.slot.key);
  if (slots.length === 0) return null;
  const hasUnknown = unknownKeys.length > 0;
  const showPrimary = hasUnknown || review.sourceLocaleDirty;

  return (
    <section
      className={`${styles.prompt} ${showPrimary ? '' : styles.compact}`}
      aria-label={t('catalogue_source_language')}
    >
      {hasUnknown && <h3 className={styles.title}>{t('editor_translations_base_language_title')}</h3>}
      {hasUnknown && (
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
      )}
      {!hasUnknown && review.sourceLocaleDirty && (
        <output className={styles.help}>{t('editor_translations_base_language_save')}</output>
      )}
      <details className={styles.details}>
        <summary>{t('translation_review_source_locale_individual')}</summary>
        <div className={styles.fields}>
          {slots.map((slot) => {
            const field = isBlank(slot.source) ? t(slot.fieldLabel) : `${slot.source} · ${t(slot.fieldLabel)}`;
            return (
              <FormField key={slot.key} label={t('editor_translations_source_locale_field', { field })}>
                <select
                  className={styles.select}
                  value={sourceLocaleKnownFor(slot.key, slot) ? sourceLocaleFor(slot.key, slot) : ''}
                  onChange={(event) => onSourceLocaleChange(slot.key, event.target.value)}
                >
                  <option value="">{t('translation_review_source_locale_required')}</option>
                  {LANGUAGE_CODES.map((locale) => (
                    <option key={locale} value={locale}>
                      {getLanguageNativeName(locale)}
                    </option>
                  ))}
                </select>
              </FormField>
            );
          })}
        </div>
      </details>
    </section>
  );
}
