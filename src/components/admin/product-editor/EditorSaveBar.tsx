'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import EditorErrorSummary from './EditorErrorSummary';
import styles from './ProductEditorPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface EditorSaveBarProps {
  readonly formId: string;
  readonly isDirty: boolean;
  readonly isSubmitting: boolean;
  readonly saveDisabled: boolean;
  readonly saveLabel: string;
  readonly errorCount: number;
  readonly errorLabel: string;
  readonly onJumpToError: () => void;
  readonly onBack: () => void;
}

/** The editor's single commit point, including its current validation summary. */
export default function EditorSaveBar({
  formId,
  isDirty,
  isSubmitting,
  saveDisabled,
  saveLabel,
  errorCount,
  errorLabel,
  onJumpToError,
  onBack,
}: EditorSaveBarProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.saveBar} ${isDirty ? styles.saveBarDirty : ''}`}>
      <EditorErrorSummary count={errorCount} label={errorLabel} onJump={onJumpToError} />
      <span className={`${styles.saveHint} ${isDirty ? styles.saveHintDirty : ''}`} aria-live="polite">
        {isDirty ? t('unsaved_changes') : ''}
      </span>
      <button type="button" className={modalStyles.cancelButton} onClick={onBack} disabled={isSubmitting}>
        {t('back')}
      </button>
      <button
        type="submit"
        form={formId}
        data-testid="editor-save"
        className={modalStyles.submitButton}
        disabled={saveDisabled}
      >
        {isSubmitting ? t('saving') : saveLabel}
      </button>
    </div>
  );
}
