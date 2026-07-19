'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Receipt } from 'lucide-react';
import styles from '../../styles/ConfirmationPage.module.css';

interface ConfirmationSuccessHeaderProps {
  orderNumber: string;
  /** Extra content below the order number (e.g. a Back-to-Menu button in the guest fallback). */
  children?: ReactNode;
}

/**
 * The "Order Received" success banner (icon + title + order number), shared by the full confirmation
 * view and the guest fallback so the markup isn't duplicated.
 */
export default function ConfirmationSuccessHeader({ orderNumber, children }: Readonly<ConfirmationSuccessHeaderProps>) {
  const { t } = useTranslation();
  return (
    <div className={styles.successHeader}>
      <div className={styles.successIcon}>
        <CheckCircle size={80} />
      </div>
      <h1 className={styles.successTitle}>{t('order_received', 'Order Received')}</h1>
      <p className={styles.successSubtitle}>
        {t(
          'order_confirmation_message',
          'Thank you for your order. We have received it and will start preparing it shortly.',
        )}
      </p>
      <div className={styles.orderNumber}>
        <Receipt size={24} />
        <div>
          <span className={styles.orderNumberLabel}>{t('order_number', 'Order Number')}</span>
          <span className={styles.orderNumberValue}>{orderNumber}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
