'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import DeliveryAddressSection from '@/components/checkout/order-type/DeliveryAddressSection';
import { useDeliveryAddress } from '@/hooks/checkout/useDeliveryAddress';
import type { DeliveryAddress } from '@/contexts/CheckoutContext';
import tableModalStyles from './TableSelectionModal.module.css';

interface DeliveryAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the captured address when the user confirms. */
  onConfirm: (address: DeliveryAddress) => void;
  /** Pre-fill (e.g. re-opening from the sticky header Change with an existing address). */
  initial?: DeliveryAddress | null;
}

/**
 * BUGS-IMPROVEMENTS-PLAN §C1.5.b — delivery follow-up modal. Owns the
 * `useDeliveryAddress` hook so all form state, saved-addresses
 * fetching, and the optional "save this address" persistence step live
 * here; renders via the existing `DeliveryAddressSection` (which is
 * agnostic and just consumes the hook's return value).
 *
 * `deliverySelected` is hardcoded to `true` because this modal is only
 * mounted when the user picks Delivery — we always want saved addresses
 * fetched immediately for logged-in customers.
 *
 * Footer button styles are shared with `TableSelectionModal` until we
 * either land a third modal that wants the same shape (then promote to
 * design-system) or a fourth pattern proves the duplication wasn't real.
 */
export default function DeliveryAddressModal({ isOpen, onClose, onConfirm, initial }: DeliveryAddressModalProps) {
  const { t } = useTranslation();

  // Sticky once the modal is opened. Passing this (rather than raw `isOpen`)
  // to useDeliveryAddress avoids re-firing the saved-addresses fetch on every
  // close/reopen cycle and prevents the in-hook `setShowNewAddressForm`
  // reset from clobbering a user's "Add new address" toggle when they
  // re-open the modal.
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  const address = useDeliveryAddress(
    initial
      ? {
          street: initial.street,
          city: initial.city,
          postalCode: initial.postalCode,
          country: initial.country,
          additionalInfo: initial.additionalInfo,
        }
      : undefined,
    hasOpened,
  );

  const handleConfirm = async () => {
    if (!address.validate()) return;
    const persisted = await address.persistIfRequested();
    if (!persisted) return;
    const trimmed = address.trimmed();
    onConfirm({
      street: trimmed.street,
      city: trimmed.city,
      postalCode: trimmed.postalCode,
      country: trimmed.country,
      additionalInfo: trimmed.additionalInfo,
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('delivery_address_modal_title', 'Where should we deliver?')}
      footer={
        <>
          <button
            type="button"
            className={tableModalStyles.secondaryButton}
            onClick={onClose}
            disabled={address.savingAddress}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={tableModalStyles.primaryButton}
            onClick={handleConfirm}
            disabled={address.savingAddress}
          >
            {address.savingAddress ? t('saving', 'Saving…') : t('confirm', 'Confirm')}
          </button>
        </>
      }
    >
      <DeliveryAddressSection address={address} />
    </BaseModal>
  );
}
