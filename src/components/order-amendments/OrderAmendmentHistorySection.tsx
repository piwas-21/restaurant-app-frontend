'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useOptionalAuth } from '@/components/AuthContext';
import OrderAmendmentHistoryBody from './OrderAmendmentHistoryBody';

const AmendmentResolutionProvider = dynamic(() => import('./AmendmentResolutionProvider'), { ssr: false });

interface Props {
  readonly orderId: string;
  readonly refreshKey: string | number;
  readonly onResolutionChanged?: () => void;
}

/** Recovery remains mounted even when operators disable new amendment history/writes. */
export default function OrderAmendmentHistorySection({ orderId, refreshKey, onResolutionChanged }: Props) {
  const [financialRefresh, setFinancialRefresh] = useState(0);
  const auth = useOptionalAuth();
  const changed = useCallback(() => {
    setFinancialRefresh((value) => value + 1);
    onResolutionChanged?.();
  }, [onResolutionChanged]);
  const history = <OrderAmendmentHistoryBody orderId={orderId} refreshKey={`${refreshKey}:${financialRefresh}`} />;
  if (auth?.user?.role !== 'Admin' || auth.isLoading) return history;
  return (
    <AmendmentResolutionProvider orderId={orderId} onChanged={changed}>
      {history}
    </AmendmentResolutionProvider>
  );
}
