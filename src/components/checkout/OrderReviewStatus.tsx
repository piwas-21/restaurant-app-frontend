'use client';

// The customer-facing acknowledgement/approval state (order confirmation flows, plan S3).
// This deliberately sits above the receipt rather than replacing it. It is also the complete
// guest-safe view when the auth-gated receipt cannot load.
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import StatusBadge from '@/components/design-system/StatusBadge';
import PreparationCountdown from '@/components/order/PreparationCountdown';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import { DEFAULT_REVIEW_WINDOW_MINUTES, type ConfirmationFlow } from '@/services/orderTypeConfigurationService';
import styles from './OrderReviewStatus.module.css';
import {
  approvedStatusCopy,
  isApprovedOrderStatus,
  legacyTimeForActivePreparation,
} from './orderReviewStatusPresentation';
export { isApprovedOrderStatus };

interface OrderReviewStatusProps {
  readonly confirmationFlow: ConfirmationFlow;
  readonly orderNumber?: string;
  readonly dailyOrderNumber?: number;
  readonly status: string;
  readonly estimatedDeliveryTime?: string | null;
  readonly expectedReadyAt?: string | null;
  readonly effectivePreparationMinutes?: number | null;
  readonly businessTimeZoneId?: string | null;
  readonly orderType?: string;
  readonly reviewWindowMinutes?: number;
  readonly reviewDeadlineUtc?: string | null;
  readonly total?: number;
  readonly currency?: string;
}

function secondsUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const deadline = new Date(value).getTime();
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function countdownLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function OrderReviewStatus({
  confirmationFlow,
  orderNumber,
  dailyOrderNumber,
  status,
  estimatedDeliveryTime,
  expectedReadyAt,
  effectivePreparationMinutes,
  businessTimeZoneId,
  orderType,
  reviewWindowMinutes = DEFAULT_REVIEW_WINDOW_MINUTES,
  reviewDeadlineUtc,
  total,
  currency,
}: OrderReviewStatusProps) {
  const { t, i18n } = useTranslation();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => secondsUntil(reviewDeadlineUtc));

  useEffect(() => {
    const update = () => setRemainingSeconds(secondsUntil(reviewDeadlineUtc));
    update();
    if (!reviewDeadlineUtc) return;
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [reviewDeadlineUtc]);

  const displayOrderNumber = getOrderDisplayNumber({ dailyOrderNumber, orderNumber });
  const orderLine = displayOrderNumber ? (
    <p className={styles.orderNumber}>
      {t('order_number')}: <strong>{displayOrderNumber}</strong>
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

  if (isApprovedOrderStatus(status)) {
    const isReady = status === 'Ready';
    const isCompleted = status === 'Completed';
    const isResolved = isReady || isCompleted || status === 'Delivered';
    const copy = approvedStatusCopy(status);
    const legacyReadyTime = legacyTimeForActivePreparation(
      status,
      expectedReadyAt,
      estimatedDeliveryTime,
      orderType,
      i18n.language,
    );
    return (
      <section className={`${styles.panel} ${styles.approved}`} aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <div className={styles.headingRow}>
            <h2>{t(copy.titleKey, copy.titleFallback)}</h2>
            <StatusBadge tone="success">{t(copy.statusKey)}</StatusBadge>
          </div>
          {orderLine}
          {!isResolved && (
            <>
              <p>
                {legacyReadyTime
                  ? t('checkout.review_approved_ready_time', 'Expected ready time: {{time}}', { time: legacyReadyTime })
                  : t('checkout.review_approved_body', 'The restaurant is preparing your order now.')}
              </p>
              <PreparationCountdown
                status={status}
                expectedReadyAt={expectedReadyAt}
                effectivePreparationMinutes={effectivePreparationMinutes}
                timeZone={businessTimeZoneId}
              />
            </>
          )}
          {totalLine}
        </div>
      </section>
    );
  }

  if (confirmationFlow === 'direct') {
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
            {t(
              'checkout.direct_pending_body',
              'Your order is awaiting restaurant confirmation. This screen will update as soon as the restaurant responds.',
            )}
          </p>
          {totalLine}
        </div>
      </section>
    );
  }

  const reviewSeconds = Math.max(1, reviewWindowMinutes) * 60;
  const progress =
    remainingSeconds === null ? 100 : Math.min(100, Math.max(0, Math.round((remainingSeconds / reviewSeconds) * 100)));
  const isOverdue = remainingSeconds === 0;

  return (
    <section className={`${styles.panel} ${styles.reviewing}`}>
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
        <div className={styles.timerRow}>
          <span>{t('checkout.review_timer_label', 'Expected response in')}</span>
          <time className={styles.countdown} aria-hidden="true">
            {remainingSeconds === null
              ? countdownLabel(Math.max(1, reviewWindowMinutes) * 60)
              : countdownLabel(remainingSeconds)}
          </time>
        </div>
        <progress
          className={styles.progressTrack}
          aria-label={t('checkout.review_timer_label', 'Expected response in')}
          max={100}
          value={progress}
        />
        {isOverdue && (
          <output className={styles.overdue}>
            {t(
              'checkout.review_overdue',
              'The review is taking longer than expected. Keep this page open; we will update it as soon as the restaurant responds.',
            )}
          </output>
        )}
        {totalLine}
      </div>
    </section>
  );
}
