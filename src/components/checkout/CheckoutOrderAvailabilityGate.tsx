'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import GuestOrderingUnavailable from '@/components/order/GuestOrderingUnavailable';
import type { useCheckoutOrderAvailability } from '@/hooks/checkout/useCheckoutOrderAvailability';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';

const OrderFlowModals = dynamic(() => import('@/components/order/OrderFlowModals'), { ssr: false });

type GateStyles = Readonly<Record<string, string>>;

interface CheckoutOrderAvailabilityGateProps {
  readonly availability: ReturnType<typeof useCheckoutOrderAvailability>;
  readonly orderTypeFollowUp: ReturnType<typeof useOrderTypeFollowUp>;
  readonly styles: GateStyles;
}

export default function CheckoutOrderAvailabilityGate({
  availability,
  orderTypeFollowUp,
  styles,
}: CheckoutOrderAvailabilityGateProps) {
  const { t } = useTranslation();
  if (availability.state === 'available') return null;
  if (availability.state === 'loading') {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={48} className={styles.spinner} />
          <p>{t('loading', 'Loading...')}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className={styles.container}>
        <div className={styles.content}>
          <GuestOrderingUnavailable
            reason={availability.state}
            onRetry={() => void availability.refresh()}
            isRefreshing={availability.isRefreshing}
            onChangeOrderType={availability.state === 'type-unavailable' ? orderTypeFollowUp.editOrderType : undefined}
          />
        </div>
      </main>
      <OrderFlowModals followUp={orderTypeFollowUp} />
    </>
  );
}
