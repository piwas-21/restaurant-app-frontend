'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './CancelReservationModal.module.css';

interface CancelReservationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Cancel-reservation confirm dialog. Migrated from a hand-rolled overlay to
 * the design-system `BaseModal` primitive (CLAUDE.md frontend §5 rule 2) —
 * BaseModal owns the portal, backdrop, ESC/backdrop dismissal, scroll lock,
 * dialog a11y wiring and the X button, and gives the dialog the craft shell
 * (`--modal-*` tokens) under that template. Only the body copy and the
 * footer buttons remain here. NOTE: BaseModal evaluates children even while
 * closed (no early-return guard in the parent) — this body is pure static
 * copy, so nothing needs guarding.
 */
export default function CancelReservationModal({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: Readonly<CancelReservationModalProps>) {
  const { t } = useTranslation();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={t('cancel_reservation_title', 'Cancel Reservation')}
      size="sm"
      footer={
        <>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isLoading}>
            {t('cancel', 'Cancel')}
          </button>
          <button type="button" className={styles.confirmButton} onClick={onConfirm} disabled={isLoading}>
            {isLoading
              ? t('my_reservations_cancelling', 'Cancelling...')
              : t('cancel_reservation', 'Cancel Reservation')}
          </button>
        </>
      }
    >
      <p className={styles.confirmMessage}>
        {t('cancel_reservation_confirm_message', 'Are you sure you want to cancel this reservation?')}
      </p>
    </BaseModal>
  );
}
