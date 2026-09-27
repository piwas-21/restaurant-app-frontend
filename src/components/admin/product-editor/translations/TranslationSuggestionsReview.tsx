'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { getLanguageNativeName } from '@/config/languageConfig';
import { directionFor } from '@/lib/textDirection';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import styles from './TranslationSuggestionsReview.module.css';

interface TranslationSuggestionsReviewProps {
  readonly review: ReturnType<typeof useEditorTranslationReview>;
}

const decisionKey = {
  pending: 'translation_review_decision_pending',
  accepted: 'translation_review_decision_accepted',
  edited: 'translation_review_decision_edited',
  rejected: 'translation_review_decision_rejected',
} as const;

const decisionTone = {
  pending: 'neutral',
  accepted: 'success',
  edited: 'info',
  rejected: 'warning',
} as const;

export default function TranslationSuggestionsReview({ review }: TranslationSuggestionsReviewProps) {
  const { t } = useTranslation();
  const { phase, entries, providerStatus, pendingLocales, manualReviewCount, error, staleCount } = review;

  return (
    <aside className={styles.drawer} aria-label={t('translation_review_title')}>
      <div className={styles.heading}>
        <div>
          <h3>{t('translation_review_title')}</h3>
          <p>{t('translation_review_intro')}</p>
        </div>
        {entries.length > 0 && (
          <button type="button" className={styles.acceptAll} onClick={review.acceptAll}>
            {t('translation_review_accept_all')}
          </button>
        )}
      </div>

      {phase === 'loading' && (
        <output className={styles.notice} role="status">
          {t('translation_review_loading')}
        </output>
      )}
      {pendingLocales > 0 && (
        <output className={styles.notice}>{t('translation_review_gaps', { count: pendingLocales })}</output>
      )}
      {manualReviewCount > 0 && (
        <output className={styles.notice}>{t('translation_review_manual_review', { count: manualReviewCount })}</output>
      )}
      {providerStatus === 'disabled' && (
        <output className={styles.notice}>{t('translation_review_provider_disabled')}</output>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {t('translation_review_unavailable')}
        </p>
      )}
      {staleCount > 0 && (
        <p className={styles.warning} role="status">
          {t('translation_review_stale_result', { count: staleCount })}
        </p>
      )}
      {phase === 'ready' && pendingLocales === 0 && entries.length === 0 && !error && (
        <output className={styles.notice}>{t('translation_review_suggestions_none')}</output>
      )}
      {phase === 'ready' && pendingLocales > 0 && entries.length === 0 && providerStatus !== 'disabled' && !error && (
        <button type="button" className={styles.acceptAll} onClick={review.suggestMissing}>
          {t('translation_review_suggest_missing')}
        </button>
      )}
      {phase === 'ready' && pendingLocales > 0 && entries.length === 0 && providerStatus === 'ready' && !error && (
        <output className={styles.notice}>{t('translation_review_suggestions_empty')}</output>
      )}

      {entries.length > 0 && (
        <div className={styles.list}>
          {entries.map((entry) => {
            const locale = entry.suggestion.locale;
            const field = `${entry.sourceText} · ${t(entry.fieldLabel)}`;
            const language = getLanguageNativeName(locale);
            return (
              <article className={styles.card} key={entry.suggestion.suggestionId}>
                <div className={styles.cardHeading}>
                  <p>{t('translation_review_row_title', { field, language })}</p>
                  <StatusBadge tone={decisionTone[entry.decision]} size="sm">
                    {t(decisionKey[entry.decision])}
                  </StatusBadge>
                </div>
                <p className={styles.sourceText} dir="auto">
                  {entry.sourceText}
                </p>
                <FormField label={t('translation_review_suggested_text', { language })}>
                  <textarea
                    value={entry.text}
                    dir={directionFor(locale)}
                    rows={2}
                    onChange={(event) => review.edit(entry.suggestion.suggestionId, event.target.value)}
                  />
                </FormField>
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => review.decide(entry.suggestion.suggestionId, 'accept')}
                    aria-label={t('translation_review_accept_field', { field, language })}
                  >
                    {t('translation_review_accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => review.decide(entry.suggestion.suggestionId, 'reject')}
                    aria-label={t('translation_review_reject_field', { field, language })}
                  >
                    {t('translation_review_reject')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
