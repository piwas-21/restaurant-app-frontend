'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Home, ShoppingBag } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './OrderConfirmationModal.module.css';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  orderNumber: string;
  customerEmail: string;
  isLoggedIn: boolean;
  onClose: () => void;
}

/**
 * Post-checkout confirmation dialog (closes #54).
 *
 * Migrated from a hand-rolled overlay to the shared `BaseModal` primitive
 * (CLAUDE.md frontend §5 rule 2). `BaseModal` now owns the portal,
 * backdrop, ESC / backdrop dismissal, body-scroll lock, `role="dialog"` +
 * `aria-modal` + `aria-labelledby`, and the X close button — so the
 * component-local overlay/modal/title scaffolding is gone. Component-
 * specific styles (icon, order-number card, email info, action buttons,
 * guest note) remain in the colocated CSS module.
 */
export default function OrderConfirmationModal({
  isOpen,
  orderNumber,
  customerEmail,
  isLoggedIn,
  onClose,
}: OrderConfirmationModalProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleViewOrders = () => {
    router.push('/orders');
  };

  const handleBackToMenu = () => {
    router.push('/menu');
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('order_received', 'Order Received')}>
      <div className={styles.iconContainer}>
        <div className={styles.successIcon}>
          <CheckCircle size={80} />
        </div>
      </div>

      <p className={styles.message}>
        {t(
          'order_confirmation_message',
          'Thank you for your order. We have received it and will start preparing it shortly.',
        )}
      </p>

      <div className={styles.orderNumberCard}>
        <span className={styles.orderNumberLabel}>{t('order_number', 'Order Number')}</span>
        <span className={styles.orderNumberValue}>{orderNumber}</span>
      </div>

      {customerEmail && (
        <div className={styles.emailInfo}>
          <span className={styles.emailLabel}>{t('confirmation_email_sent_to', 'Confirmation email sent to:')}</span>
          <span className={styles.email}>{customerEmail}</span>
        </div>
      )}

      <div className={styles.actions}>
        {isLoggedIn ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={handleViewOrders}>
              <ShoppingBag size={20} />
              {t('track_order', 'Track Order')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleBackToMenu}>
              <Home size={20} />
              {t('back_to_menu', 'Back to Menu')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.primaryButton} onClick={handleBackToMenu}>
              <Home size={20} />
              {t('back_to_menu', 'Back to Menu')}
            </button>
            <p className={styles.guestNote}>
              {t('login_to_track_order', '💡 Login to your account to track your order status in real-time.')}
            </p>
          </>
        )}
      </div>
    </BaseModal>
  );
}
