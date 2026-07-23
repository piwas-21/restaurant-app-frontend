'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthContext';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './ReservationSuccessModal.module.css';

interface ReservationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerEmail: string;
  numberOfTables: number;
}

/**
 * Post-booking "pending confirmation" dialog. Migrated from a hand-rolled
 * overlay to the design-system `BaseModal` primitive (CLAUDE.md frontend §5
 * rule 2) — BaseModal owns the portal, backdrop, dismissal, a11y wiring and
 * the X button, and gives the dialog the craft shell (`--modal-*` tokens)
 * under that template. The logged-in vs guest CTA branches are unchanged.
 * NOTE: BaseModal evaluates children even while closed — the body reads only
 * plain string/number props and the (provider-backed) auth user, so nothing
 * here can throw while closed.
 */
export default function ReservationSuccessModal({
  isOpen,
  onClose,
  customerEmail,
  numberOfTables,
}: Readonly<ReservationSuccessModalProps>) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('reservation_pending_confirmation', 'Pending Confirmation')}
      size="md"
    >
      <div className={styles.iconContainer}>
        <div className={styles.clockIcon}>⏳</div>
      </div>

      <p className={styles.message}>
        {t(
          'reservation_pending_message',
          numberOfTables > 1
            ? 'Your reservations are currently pending. Our team will review your request and send you a confirmation email shortly.'
            : 'Your reservation is currently pending. Our team will review your request and send you a confirmation email shortly.',
        )}
      </p>

      <div className={styles.emailInfo}>
        <span className={styles.emailLabel}>{t('confirmation_email_sent_to', 'Confirmation will be sent to:')}</span>
        <span className={styles.email}>{customerEmail}</span>
      </div>

      <div className={styles.actions}>
        {user ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={() => router.push('/my-reservations')}>
              {t('view_my_reservations', 'View My Reservations')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              {t('make_another_reservation', 'Make Another Reservation')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.primaryButton} onClick={() => router.push('/auth/login')}>
              {t('login_to_track_reservation', 'Login to Track Your Reservation')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              {t('make_another_reservation', 'Make Another Reservation')}
            </button>
            <p className={styles.guestNote}>
              {t(
                'create_account_to_track',
                '💡 Create an account to easily track all your reservations and manage them online.',
              )}
            </p>
          </>
        )}
      </div>
    </BaseModal>
  );
}
