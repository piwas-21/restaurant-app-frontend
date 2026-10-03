'use client';

import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import CashierTablePaymentForm from './CashierTablePaymentForm';
import CashierAccountPaymentCollectionHost from './CashierAccountPaymentCollectionHost';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly locked: boolean;
  readonly canCollect: boolean;
  readonly onUpdated: () => void;
  readonly onSubmitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
}

export default function CashierTableSessionPaymentCollection({
  session,
  locked,
  canCollect,
  onUpdated,
  onSubmitPayment,
}: Props) {
  const fallback = canCollect ? (
    <CashierTablePaymentForm session={session} disabled={locked} onSubmit={onSubmitPayment} />
  ) : null;

  return (
    <CashierAccountPaymentCollectionHost
      session={session}
      disabled={locked || !canCollect}
      recoveryEnabled={!locked}
      onUpdated={onUpdated}
      fallback={fallback}
    />
  );
}
