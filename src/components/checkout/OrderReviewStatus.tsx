'use client';

// The customer-facing acknowledgement/approval state (order confirmation flows, plan S3).
// This deliberately sits above the receipt rather than replacing it. It is also the complete
// guest-safe view when the auth-gated receipt cannot load.
import type { CSSProperties } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { ConfirmationFlow } from '@/services/orderTypeConfigurationService';
import styles from './OrderReviewStatus.module.css';

interface OrderReviewStatusProps {
  readonly confirmationFlow: ConfirmationFlow;
  readonly orderNumber?: string;
  readonly status: string;
  readonly estimatedDeliveryTime?: string | null;
  readonly reviewWindowMinutes: number;
  readonly total?: number;
  readonly currency?: string;
}

const approvedStatuses = new Set(['Confirmed', 'Preparing', 'Ready', 'Completed']);

function readyTime(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function OrderReviewStatus({
  confirmationFlow,
  orderNumber,
  status,
  estimatedDeliveryTime,
  reviewWindowMinutes,
  total,
  currency,
}: OrderReviewStatusProps) {
  const { t, i18n } = useTranslation();

  if (confirmationFlow !== 'acknowledge') return null;

  const orderLine = orderNumber ? (
    <p className={styles.orderNumber}>
      {t('order_number')}: <strong>{orderNumber}</strong>
    </p>
  ) : null;
  const totalLine =
    typeof total === 'number' && currency ? (
      <p className={styles.total}>
        {t('checkout.review_total', 'Order total')}: <strong>{formatCurrency(total, undefined, currency)}</strong>
      </p>
    ) : null;

  if (status === 'Cancelled' || status === 'Refunded') {
    return (
      <section className={`${styles.panel} ${styles.cancelled}`} aria-live="polite">
        <XCircle aria-hidden="true" />
        <div>
          <div className={styles.headingRow}>
            <h2>{t('checkout.review_cancelled_title', 'The restaurant could not accept this order')}</h2>
            <StatusBadge tone="danger">{t('order_status_cancelled')}</StatusBadge>
          </div>
          {orderLine}
          <p>{t('checkout.review_cancelled_body', 'Please check your email for the cancellation details.')}</p>
          {totalLine}
        </div>
      </section>
    );
  }

  if (status === 'PendingApproval') {
    const time = readyTime(estimatedDeliveryTime, i18n.language);
    return (
      <section className={`${styles.panel} ${styles.reviewing}`} aria-live="polite">
        <Clock3 aria-hidden="true" />
        <div>
          <div className={styles.headingRow}>
            <h2>{t('checkout.review_delay_title', 'Please approve the longer wait')}</h2>
            <StatusBadge tone="warning">{t('order_status_pending_approval')}</StatusBadge>
          </div>
          {orderLine}
          {time && <p>{t('checkout.review_approved_ready_time', 'Expected ready time: {{time}}', { time })}</p>}
          <p>
            {t(
              'checkout.review_delay_body',
              'The restaurant needs your approval for a longer wait. Check your email to respond.',
            )}
          </p>
          {totalLine}
        </div>
      </section>
    );
  }

  if (approvedStatuses.has(status)) {
    const time = readyTime(estimatedDeliveryTime, i18n.language);
    return (
      <section className={`${styles.panel} ${styles.approved}`} aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <div className={styles.headingRow}>
            <h2>{t('checkout.review_approved_title', 'Your order is approved')}</h2>
            <StatusBadge tone="success">{t('order_status_confirmed')}</StatusBadge>
          </div>
          {orderLine}
          <p>
            {time
              ? t('checkout.review_approved_ready_time', 'Expected ready time: {{time}}', { time })
              : t('checkout.review_approved_body', 'The restaurant is preparing your order now.')}
          </p>
          {totalLine}
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.reviewing}`} aria-live="polite">
      <Clock3 aria-hidden="true" />
      <div className={styles.reviewBody}>
        <div className={styles.headingRow}>
          <h2>{t('checkout.review_received_title', 'We have received your order')}</h2>
          <StatusBadge tone="info">{t('order_status_pending')}</StatusBadge>
        </div>
        {orderLine}
        <p>
          {t('checkout.review_received_body', {
            count: reviewWindowMinutes,
            defaultValue: 'The restaurant is reviewing it. We usually reply within {{count}} minute.',
          })}
        </p>
        <div className={styles.progressTrack} aria-hidden="true">
          {/* Dynamic exception: CSS owns the animation; inline sets only its duration variable. */}
          <span
            className={styles.progressFill}
            style={{ '--review-duration': `${Math.max(1, reviewWindowMinutes) * 60}s` } as CSSProperties}
          />
        </div>
        {totalLine}
      </div>
    </section>
  );
}
