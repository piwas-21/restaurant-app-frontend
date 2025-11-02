'use client';

import { useRouter } from 'next/navigation';
import styles from './ReservationSuccessModal.module.css';

interface ReservationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  customerEmail: string;
  numberOfTables: number;
}

export default function ReservationSuccessModal({
  isOpen,
  onClose,
  isLoggedIn,
  customerEmail,
  numberOfTables
}: ReservationSuccessModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleViewReservations = () => {
    router.push('/my-reservations');
  };

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const handleMakeAnother = () => {
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>

        <div className={styles.iconContainer}>
          <div className={styles.clockIcon}>⏳</div>
        </div>

        <h2 className={styles.title}>Pending Confirmation</h2>

        <p className={styles.message}>
          Your reservation{numberOfTables > 1 ? 's are' : ' is'} currently pending.
          Our team will review your request and send you a confirmation email shortly.
        </p>

        <div className={styles.emailInfo}>
          <span className={styles.emailLabel}>Confirmation will be sent to:</span>
          <span className={styles.email}>{customerEmail}</span>
        </div>

        <div className={styles.actions}>
          {isLoggedIn ? (
            <>
              <button className={styles.primaryButton} onClick={handleViewReservations}>
                View My Reservations
              </button>
              <button className={styles.secondaryButton} onClick={handleMakeAnother}>
                Make Another Reservation
              </button>
            </>
          ) : (
            <>
              <button className={styles.primaryButton} onClick={handleLogin}>
                Login to Track Your Reservation
              </button>
              <button className={styles.secondaryButton} onClick={handleMakeAnother}>
                Make Another Reservation
              </button>
              <p className={styles.guestNote}>
                💡 Create an account to easily track all your reservations and manage them online.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
