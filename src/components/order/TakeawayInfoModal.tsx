'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { useGuestCustomerInfo } from '@/hooks/order/useGuestCustomerInfo';
import GuestCustomerInfoFields from './GuestCustomerInfoFields';
import tableModalStyles from './TableSelectionModal.module.css';

interface TakeawayInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fired when the user confirms with valid customer info. Parent decides
   * what to do next — typically just closes; the smart-skip router on the
   * sidebar's Proceed-to-Checkout will then route to /checkout/review
   * since CheckoutContext.customerInfo is now populated.
   */
  onConfirm: () => void;
}

/**
 * BUGS-IMPROVEMENTS-PLAN §C1.5.e — Takeaway info modal. Opens only for
 * users whose profile is missing one or more of name/email/phone (guests
 * always; logged-in users only when the field they need isn't on their
 * profile yet). Logged-in users with everything on file see no inputs
 * at all and never reach this modal — the `pickType('Takeaway')` branch
 * in `useOrderTypeFollowUp` skips it entirely.
 *
 * Footer button styles are shared with TableSelectionModal —
 * non-critical duplication; promote to design-system if a fourth modal
 * lands with the same footer shape.
 */
export default function TakeawayInfoModal({ isOpen, onClose, onConfirm }: TakeawayInfoModalProps) {
  const { t } = useTranslation();
  const guest = useGuestCustomerInfo({
    requiredFields: ['name', 'email', 'phone'],
    enabled: isOpen,
  });

  const handleConfirm = () => {
    if (guest.commit() === null) return;
    onConfirm();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('takeaway_info_title', 'Almost there — your details')}
      footer={
        <>
          <button type="button" className={tableModalStyles.secondaryButton} onClick={onClose}>
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={tableModalStyles.primaryButton}
            onClick={handleConfirm}
            disabled={guest.isLoadingUser}
          >
            {t('confirm', 'Confirm')}
          </button>
        </>
      }
    >
      <GuestCustomerInfoFields
        value={guest.value}
        errors={guest.errors}
        visibleFields={guest.visibleFields}
        showRegisterCta={guest.showRegisterCta}
        onChange={guest.setField}
        onBlur={guest.blurField}
      />
    </BaseModal>
  );
}
