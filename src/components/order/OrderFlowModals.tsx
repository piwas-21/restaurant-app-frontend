'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import type { CustomerInfoField } from './GuestCustomerInfoFields';
import TableSelectionModal from './TableSelectionModal';
import DeliveryAddressModal from './DeliveryAddressModal';
import TakeawayInfoModal from './TakeawayInfoModal';
import EditOrderTypeModal from './EditOrderTypeModal';

// Stable references (feeding useGuestCustomerInfo's memoised commit). Dine-In
// requires only name+email; Takeaway/Delivery also require phone.
const CONTACT_FIELDS_DINEIN: ReadonlyArray<CustomerInfoField> = ['name', 'email'];
const CONTACT_FIELDS_FULL: ReadonlyArray<CustomerInfoField> = ['name', 'email', 'phone'];

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
  const { t } = useTranslation();
  const { state, setTable, setAddress } = useOrderType();

  // Contact editor: require only what the current order type does — a Dine-In
  // edit must not force a phone number (Dine-In needs just name+email). This
  // also covers the takeaway pick (orderType is Takeaway there → phone required).
  const contactRequiredFields = state.orderType === OrderType.DineIn ? CONTACT_FIELDS_DINEIN : CONTACT_FIELDS_FULL;

  // Review-page type change — tag the funnel event as the review surface, not the sidebar.
  // Destructure the (stable) pickType so the memo deps don't pull the whole followUp object.
  const { pickType } = followUp;
  const pickTypeFromReview = useCallback((type: OrderType) => pickType(type, 'checkout_review'), [pickType]);

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

      {/* Takeaway follow-up (picks Takeaway) and the review page's contact-only
          "Edit" share this modal — same fields + commit, only the title and the
          required set (order-type-aware) differ. */}
      <TakeawayInfoModal
        isOpen={followUp.followUp === 'takeaway' || followUp.followUp === 'contact'}
        onClose={followUp.closeFollowUp}
        onConfirm={followUp.closeFollowUp}
        title={followUp.followUp === 'contact' ? t('edit_contact_title', 'Edit your details') : undefined}
        requiredFields={contactRequiredFields}
      />

      {/* Review page "Edit Order Details" — pick a type, then its detail modal opens. */}
      <EditOrderTypeModal
        isOpen={followUp.followUp === 'ordertype'}
        onClose={followUp.closeFollowUp}
        onPick={pickTypeFromReview}
      />
    </>
  );
}
