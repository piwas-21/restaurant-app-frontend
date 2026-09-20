'use client';

// Guest-only shell around the read-only live status. The full receipt remains available when the
// auth-gated order read succeeds; when it does not, this focused view still proves the order was
// received and follows it through review without exposing customer/order-detail fields.
import { AlertCircle, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { GuestOrderStatusDto } from '@/types/order';
import type { ConfirmationFlowConfig } from '@/hooks/orderTypes/useConfirmationFlowConfig';
import OrderReviewStatus from './OrderReviewStatus';
import styles from '@/app/styles/ConfirmationPage.module.css';

interface GuestOrderLiveViewProps {
  readonly orderNumber: string | null;
  readonly status: GuestOrderStatusDto | null;
  readonly config: ConfirmationFlowConfig | null;
  readonly unavailable: boolean;
}

export default function GuestOrderLiveView({ orderNumber, status, config, unavailable }: GuestOrderLiveViewProps) {
  const { t } = useTranslation();
  const router = useRouter();

  if (unavailable || !status) {
    return (
      <main className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={64} className={styles.errorIcon} />
          <h1>{t('error', 'Error')}</h1>
          <p>{t('order_not_found', 'Order not found')}</p>
          <button type="button" onClick={() => router.push('/menu')} className={styles.menuButton}>
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
          confirmationFlow={config?.flow ?? 'acknowledge'}
          orderNumber={orderNumber || status.orderNumber}
          status={status.status}
          estimatedDeliveryTime={status.estimatedDeliveryTime}
          reviewWindowMinutes={config?.reviewWindowMinutes ?? 2}
        />
        <button type="button" onClick={() => router.push('/menu')} className={styles.menuButton}>
          <Home size={20} />
          {t('back_to_menu', 'Back to Menu')}
        </button>
      </div>
    </main>
  );
}
