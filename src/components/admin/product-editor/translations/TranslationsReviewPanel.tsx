'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import TranslationSuggestionsReview from './TranslationSuggestionsReview';
import actionStyles from './TranslationActions.module.css';

export interface TranslationsReviewControls {
  readonly review: ReturnType<typeof useEditorTranslationReview>;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onApply: () => Promise<void>;
}

export default function TranslationsReviewPanel({ controls }: { readonly controls: TranslationsReviewControls }) {
  const { t } = useTranslation();
  const hasDecisions = controls.review.entries.some((entry) => entry.decision !== 'pending');
  return (
    <div id="editor-translation-review-panel" className={actionStyles.reviewPanel}>
      <TranslationSuggestionsReview review={controls.review} />
      <div className={actionStyles.reviewActions}>
        <button type="button" className={actionStyles.copyButton} onClick={controls.onToggle}>
          {t('close')}
        </button>
        {hasDecisions && (
          <button
            type="button"
            className={actionStyles.suggestButton}
            onClick={() => void controls.onApply()}
            disabled={controls.review.phase === 'loading'}
          >
            {t('editor_translations_apply_review_to_draft')}
          </button>
        )}
      </div>
    </div>
  );
}
