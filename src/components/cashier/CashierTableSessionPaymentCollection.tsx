'use client';

import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import CashierTablePaymentForm from './CashierTablePaymentForm';
import CashierAccountPaymentCollectionHost from './CashierAccountPaymentCollectionHost';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly locked: boolean;
  readonly recoveryBlocked?: boolean;
  readonly canCollect: boolean;
  readonly onUpdated: () => void;
  readonly onNavigationLockChange?: (locked: boolean) => void;
  readonly onSubmitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
}

export default function CashierTableSessionPaymentCollection({
  session,
  locked,
  recoveryBlocked = locked,
  canCollect,
  onUpdated,
  onNavigationLockChange,
  onSubmitPayment,
}: Props) {
  const fallback = canCollect ? (
    <CashierTablePaymentForm session={session} disabled={locked} onSubmit={onSubmitPayment} />
  ) : null;

  return (
    <CashierAccountPaymentCollectionHost
      session={session}
      disabled={locked || !canCollect}
      recoveryEnabled={!recoveryBlocked}
      onUpdated={onUpdated}
      onNavigationLockChange={onNavigationLockChange}
      fallback={fallback}
    />
  );
}
