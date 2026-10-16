'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useOptionalAuth } from '@/components/AuthContext';
import type { OrderDto } from '@/types/order';
import OrderAmendmentHistoryBody from './OrderAmendmentHistoryBody';

const AmendmentResolutionProvider = dynamic(() => import('./AmendmentResolutionProvider'), { ssr: false });

interface Props {
  readonly orderId: string;
  readonly relatedOrders?: readonly OrderDto[];
  readonly onSelectOrder?: (orderId: string) => void;
  readonly refreshKey: string | number;
  readonly onResolutionChanged?: () => void;
}

/** Recovery remains mounted even when operators disable new amendment history/writes. */
export default function OrderAmendmentHistorySection({
  orderId,
  refreshKey,
  onResolutionChanged,
  relatedOrders,
  onSelectOrder,
}: Props) {
  const [financialRefresh, setFinancialRefresh] = useState(0);
  const auth = useOptionalAuth();
  const changed = useCallback(() => {
    setFinancialRefresh((value) => value + 1);
    onResolutionChanged?.();
  }, [onResolutionChanged]);
  const history = (
    <OrderAmendmentHistoryBody
      orderId={orderId}
      relatedOrders={relatedOrders}
      onSelectOrder={onSelectOrder}
      refreshKey={`${refreshKey}:${financialRefresh}`}
    />
  );
  if (auth?.user?.role !== 'Admin' || auth.isLoading) return history;
  return (
    <AmendmentResolutionProvider orderId={orderId} onChanged={changed}>
      {history}
    </AmendmentResolutionProvider>
  );
}
