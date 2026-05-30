'use client';

import React, { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import BaseModal, { type BaseModalSize } from './BaseModal';
import styles from './AlertDialog.module.css';

export type AlertDialogVariant = 'danger' | 'warning' | 'info';

export interface AlertDialogProps {
  /** Controls visibility. When false the dialog is unmounted. */
  isOpen: boolean;
  /** Cancel / dismiss (Cancel button, ESC, backdrop, X). */
  onClose: () => void;
  /** Fired when the confirm button is activated. */
  onConfirm: () => void;
  /** Heading text — also the accessible label (via BaseModal). */
  title: string;
  /** Message body. */
  children: ReactNode;
  /** Confirm-button emphasis. Default `info`. */
  variant?: AlertDialogVariant;
  /** Confirm button label. Default `t('confirm')`. */
  confirmLabel?: string;
  /** Cancel button label. Default `t('cancel')`. */
  cancelLabel?: string;
  /** While true, shows a spinner on the confirm button and disables both buttons + dismissal. */
  isConfirming?: boolean;
  /**
   * Type-to-confirm guard. When a non-empty string, an input is shown and the
   * confirm button stays disabled until the typed value matches it exactly.
   */
  confirmationText?: string;
  /** BaseModal size preset. Default `sm`. */
  size?: BaseModalSize;
  disableBackdropClose?: boolean;
  disableEscapeClose?: boolean;
}

/**
 * Confirmation dialog built on {@link BaseModal} (CLAUDE.md frontend §5 rule 2;
 * SPRINT-PLAN 5.2). Replaces the ad-hoc ConfirmationModal /
 * DeleteConfirmationModal / CancelOrderDialog pattern: a message body plus
 * Cancel/Confirm actions, with `variant` emphasis, an `isConfirming` spinner,
 * and an optional `confirmationText` type-to-confirm guard for destructive actions.
 */
export default function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  variant = 'info',
  confirmLabel,
  cancelLabel,
  isConfirming = false,
  confirmationText,
  size = 'sm',
  disableBackdropClose,
  disableEscapeClose,
}: AlertDialogProps) {
  const { t } = useTranslation();
  const inputId = `alert-dialog-confirm-${useId()}`;
  const [typed, setTyped] = useState('');

  // Reset the type-to-confirm field each time the dialog (re)opens.
  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  const requiresTyping = typeof confirmationText === 'string' && confirmationText.length > 0;
  const typedMatches = !requiresTyping || typed === confirmationText;
  const confirmDisabled = isConfirming || !typedMatches;

  const footer = (
    <>
      <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isConfirming}>
        {cancelLabel ?? t('cancel', 'Cancel')}
      </button>
      <button
        type="button"
        className={`${styles.confirmButton} ${styles[variant]}`}
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        {isConfirming ? (
          <>
            <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
            {t('loading', 'Loading...')}
          </>
        ) : (
          (confirmLabel ?? t('confirm', 'Confirm'))
        )}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size={size}
      // Block dismissal while the confirm action is in flight.
      disableBackdropClose={disableBackdropClose || isConfirming}
      disableEscapeClose={disableEscapeClose || isConfirming}
    >
      <div className={styles.message}>{children}</div>
      {requiresTyping && (
        <div className={styles.confirmField}>
          <label htmlFor={inputId} className={styles.confirmFieldLabel}>
            {t('type_to_confirm', 'Type {{text}} to confirm', { text: confirmationText })}
          </label>
          <input
            id={inputId}
            type="text"
            className={styles.confirmInput}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            disabled={isConfirming}
          />
        </div>
      )}
    </BaseModal>
  );
}
