'use client';

import { useOptionalAuth } from '@/components/AuthContext';
import type { TableServiceSessionDto } from '@/types/order';
import CashierAccountPaymentCollectionHost from '@/components/cashier/CashierAccountPaymentCollectionHost';

interface Props {
  readonly session: TableServiceSessionDto;
  readonly disabled: boolean;
  readonly recoveryEnabled: boolean;
  readonly canStartCollection: boolean;
  readonly expanded: boolean;
  readonly onUpdated: () => void;
}

export default function ServerAccountPaymentCollectionHost({
  session,
  disabled,
  recoveryEnabled,
  canStartCollection,
  expanded,
  onUpdated,
}: Props) {
  const auth = useOptionalAuth();
  const role = auth?.user?.role.toLowerCase();
  return (
    <CashierAccountPaymentCollectionHost
      session={session}
      disabled={disabled}
      recoveryEnabled={recoveryEnabled}
      canStartCollection={canStartCollection && expanded}
      showActorFailure={role === 'server' || role === 'admin'}
      onUpdated={onUpdated}
      fallback={null}
    />
  );
}
