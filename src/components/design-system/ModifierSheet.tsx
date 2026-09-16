'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal, { type BaseModalProps } from './BaseModal';
import styles from './StaffWorkspaceControls.module.css';

export interface ModifierSheetProps extends Omit<BaseModalProps, 'children' | 'footer' | 'title'> {
  title: string;
  children: ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  footer?: ReactNode;
}

/**
 * Shared modifier overlay chrome. Selection and pricing stay with the existing customization
 * hooks; this component only supplies the common modal, focus and action contract.
 */
export default function ModifierSheet({
  title,
  children,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  footer,
  onClose,
  ...modalProps
}: Readonly<ModifierSheetProps>) {
  const { t } = useTranslation();
  const actions = footer ?? (
    <>
      <button type="button" className={styles.actionButton} onClick={onClose} disabled={modalProps.isPending}>
        {cancelLabel ?? t('common.cancel', 'Cancel')}
      </button>
      {onConfirm && (
        <button
          type="button"
          className={`${styles.actionButton} ${styles.primary}`}
          onClick={onConfirm}
          disabled={confirmDisabled || modalProps.isPending}
        >
          {confirmLabel ?? t('common.confirm', 'Confirm')}
        </button>
      )}
    </>
  );

  return (
    <BaseModal
      {...modalProps}
      isOpen={modalProps.isOpen}
      onClose={onClose}
      title={title}
      footer={actions}
      presentation="responsive-sheet"
    >
      {children}
    </BaseModal>
  );
}
