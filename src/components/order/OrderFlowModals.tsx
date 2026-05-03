'use client';

import React from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import TableSelectionModal from './TableSelectionModal';
import DeliveryAddressModal from './DeliveryAddressModal';

interface OrderFlowModalsProps {
  /** The full return value from `useOrderTypeFollowUp`. */
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
}

/**
 * Renders the table + address follow-up modals as a single cluster
 * driven by `useOrderTypeFollowUp`. Sidebar's order-type toggle calls
 * `followUp.pickType(type)`; this component shows the matching modal.
 *
 * Modals are mounted unconditionally; their own `isOpen` props gate
 * visibility. New follow-ups (e.g. allergen prefs) plug in here.
 */
export default function OrderFlowModals({ followUp }: OrderFlowModalsProps) {
  const { state, setTable, setAddress } = useOrderType();

  return (
    <>
      <TableSelectionModal
        isOpen={followUp.followUp === 'table'}
        onClose={followUp.closeFollowUp}
        onConfirm={setTable}
        initialTable={state.table}
      />

      <DeliveryAddressModal
        isOpen={followUp.followUp === 'address'}
        onClose={followUp.closeFollowUp}
        onConfirm={setAddress}
        initial={state.deliveryAddress}
      />
    </>
  );
}
