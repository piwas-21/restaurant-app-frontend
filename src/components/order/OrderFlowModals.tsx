'use client';

import React from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import type { useOrderTypeWelcomePrompt } from '@/hooks/order/useOrderTypeWelcomePrompt';
import OrderTypeWelcomeModal from './OrderTypeWelcomeModal';
import TableSelectionModal from './TableSelectionModal';
import DeliveryAddressModal from './DeliveryAddressModal';

interface OrderFlowModalsProps {
  /** The full return value from `useOrderTypeWelcomePrompt`. */
  prompt: ReturnType<typeof useOrderTypeWelcomePrompt>;
}

/**
 * Renders the welcome modal + the two follow-up modals (table for
 * dine-in, address for delivery). Keeps the host page (currently /menu)
 * thin — the page just calls the hook and passes its return through.
 *
 * Modals are rendered unconditionally; their own `isOpen` props gate
 * visibility. Mounting the component cluster instead of the individual
 * modals also makes it trivial to add new follow-ups (e.g. allergens,
 * accessibility prefs) when the plan grows beyond C1.5.b.
 */
export default function OrderFlowModals({ prompt }: OrderFlowModalsProps) {
  const { state, setTable, setAddress } = useOrderType();

  return (
    <>
      <OrderTypeWelcomeModal
        isOpen={prompt.showWelcomeModal}
        onClose={prompt.closeWelcomeModal}
        onChosen={prompt.handleWelcomeChosen}
      />

      <TableSelectionModal
        isOpen={prompt.followUp === 'table'}
        onClose={prompt.closeFollowUp}
        onConfirm={setTable}
        initialTable={state.table}
      />

      <DeliveryAddressModal
        isOpen={prompt.followUp === 'address'}
        onClose={prompt.closeFollowUp}
        onConfirm={setAddress}
        initial={state.deliveryAddress}
      />
    </>
  );
}
