'use client';

// Guest-only shell around the read-only live status. The full receipt remains available when the
// auth-gated order read succeeds; when it does not, this focused view still proves the order was
// received and follows it through review without exposing customer/order-detail fields.
import { AlertCircle, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GuestOrderStatusDto } from '@/types/order';
import { useTenantPublicNavigation } from '@/hooks/useTenantPublicNavigation';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import OrderReviewStatus from './OrderReviewStatus';
import styles from '@/app/styles/ConfirmationPage.module.css';

interface GuestOrderLiveViewProps {
  readonly orderNumber: string | null;
  readonly status: GuestOrderStatusDto | null;
  readonly unavailable: boolean;
}

export default function GuestOrderLiveView({ orderNumber, status, unavailable }: GuestOrderLiveViewProps) {
  const { t } = useTranslation();
  const { pushMenu } = useTenantPublicNavigation();

  if (unavailable || !status) {
    return (
      <main className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={64} className={styles.errorIcon} />
          <h1>{t('error', 'Error')}</h1>
          <p>{t('order_not_found', 'Order not found')}</p>
          <button type="button" onClick={pushMenu} className={styles.menuButton}>
            {t('back_to_menu', 'Back to Menu')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <OrderReviewStatus
          confirmationFlow={status.confirmationFlow}
          orderNumber={getOrderDisplayNumber({
            dailyOrderNumber: status.dailyOrderNumber,
            orderNumber: orderNumber || status.orderNumber,
          })}
          dailyOrderNumber={status.dailyOrderNumber}
          status={status.status}
          estimatedDeliveryTime={status.estimatedDeliveryTime}
          expectedReadyAt={status.expectedReadyAt}
          effectivePreparationMinutes={status.effectivePreparationMinutes}
          businessTimeZoneId={status.businessTimeZoneId}
          orderType={status.type}
          reviewWindowMinutes={status.reviewWindowMinutes}
          reviewDeadlineUtc={status.reviewDeadlineUtc}
        />
        <button type="button" onClick={pushMenu} className={styles.menuButton}>
          <Home size={20} />
          {t('back_to_menu', 'Back to Menu')}
        </button>
      </div>
    </main>
  );
}
