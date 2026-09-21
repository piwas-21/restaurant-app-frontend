'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Home, ShoppingBag } from 'lucide-react';
import { PaymentMethod } from '@/types/order';
import type { ConfirmationFlow } from '@/services/orderTypeConfigurationService';
import { useGuestOrderWatch } from '@/hooks/checkout/useGuestOrderWatch';
import BaseModal from '@/components/design-system/BaseModal';
import OrderReviewStatus from './OrderReviewStatus';
import styles from './OrderConfirmationModal.module.css';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  paymentMethod: PaymentMethod;
  guestStatusToken?: string;
  confirmationFlow?: ConfirmationFlow;
  isLoggedIn: boolean;
  onClose: () => void;
  onTrackOrder: () => void;
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
  orderId,
  orderNumber,
  customerEmail,
  paymentMethod,
  guestStatusToken,
  confirmationFlow = 'direct',
  isLoggedIn,
  onClose,
  onTrackOrder,
}: OrderConfirmationModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const guestWatch = useGuestOrderWatch(orderId, guestStatusToken ?? null);

  const handleBackToMenu = () => {
    router.push('/menu');
  };

  let statusContent: ReactNode;
  if (guestWatch.status) {
    statusContent = (
      <OrderReviewStatus
        confirmationFlow={guestWatch.status.confirmationFlow}
        status={guestWatch.status.status}
        estimatedDeliveryTime={guestWatch.status.estimatedDeliveryTime}
        reviewWindowMinutes={guestWatch.status.reviewWindowMinutes}
        reviewDeadlineUtc={guestWatch.status.reviewDeadlineUtc}
      />
    );
  } else if (confirmationFlow === 'direct') {
    statusContent = <OrderReviewStatus confirmationFlow="direct" status="Pending" />;
  } else {
    statusContent = (
      <p className={styles.message} aria-live="polite">
        {t(
          'order_confirmation_message',
          'We have received your order. This screen will update as soon as the restaurant responds.',
        )}
      </p>
    );
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('order_received', 'Order Received')}>
      {statusContent}

      {paymentMethod === PaymentMethod.CreditCard && (
        <p role="note" className={styles.paymentReminder}>
          {t(
            'payment_card_at_restaurant_reminder',
            'Please pay by card at the restaurant when you arrive. Your order is not paid yet.',
          )}
        </p>
      )}

      <div className={styles.orderNumberCard}>
        <span className={styles.orderNumberLabel}>{t('order_number', 'Order Number')}</span>
        <span className={styles.orderNumberValue}>{orderNumber}</span>
      </div>

      {customerEmail && (
        <div className={styles.emailInfo}>
          <span className={styles.emailLabel}>{t('order_updates_sent_to', 'Order updates will be sent to:')}</span>
          <span className={styles.email}>{customerEmail}</span>
        </div>
      )}

      <div className={styles.actions}>
        {guestStatusToken || isLoggedIn ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={onTrackOrder}>
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
