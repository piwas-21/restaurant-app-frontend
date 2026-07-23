'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './CancelSuccessModal.module.css';

interface CancelSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCloseMs?: number;
}

/**
 * Post-cancellation success dialog. Migrated from a hand-rolled overlay to
 * the design-system `BaseModal` primitive (CLAUDE.md frontend §5 rule 2) —
 * BaseModal owns the portal, backdrop, dismissal and a11y wiring, and gives
 * the dialog the craft shell (`--modal-*` tokens) under that template; craft
 * additionally stamps the check icon as a wax seal via `--modal-body-seal-*`.
 * The auto-close timer stays here (already `isOpen`-guarded, so it is inert
 * while the modal is closed). NOTE: BaseModal evaluates children even while
 * closed — this body is pure static copy, so nothing needs guarding.
 */
export default function CancelSuccessModal({ isOpen, onClose, autoCloseMs = 3000 }: Readonly<CancelSuccessModalProps>) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && autoCloseMs > 0) {
      const timer = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, onClose]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('my_reservations_cancelled_success', 'Reservation cancelled successfully')}
      size="sm"
      footer={
        <button type="button" className={styles.closeButton} onClick={onClose}>
          {t('close', 'Close')}
        </button>
      }
    >
      <div className={styles.iconContainer}>
        <div className={styles.successIcon}>
          <CheckCircle size={32} />
        </div>
      </div>

      <p className={styles.successMessage}>
        {t(
          'reservation_cancel_success_message',
          'Your reservation has been cancelled. You can make a new reservation anytime.',
        )}
      </p>
    </BaseModal>
  );
}
