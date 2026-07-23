'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { useGuestCustomerInfo } from '@/hooks/order/useGuestCustomerInfo';
import GuestCustomerInfoFields, { type CustomerInfoField } from './GuestCustomerInfoFields';
import tableModalStyles from './TableSelectionModal.module.css';

// Order-type floor for Takeaway: phone is the pickup contact, so the admin
// `checkout_contact` config can add requiredness/visibility on top but never
// remove these (merge in `mergeContactFieldRules`). Module-level constant —
// frozen at load, so the reference is stable across renders (inlining the
// array would allocate per render and defeat the hook's memoised commit).
const TAKEAWAY_REQUIRED_FIELDS = ['name', 'email', 'phone'] as const;

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
  /**
   * Optional heading override. Defaults to the takeaway copy; the review page's
   * "Edit Customer Information" reuses this modal with an edit-flavoured title
   * (the fields + commit are identical — it just edits contact info in place).
   */
  title?: string;
  /**
   * Order-type floor for the contact fields. Defaults to name+email+phone
   * (Takeaway). The review page's contact editor passes the order-type-
   * appropriate set so a Dine-In edit doesn't force a phone number (its floor
   * is name+email); the admin config merges on top of whichever floor is given.
   * Pass a stable reference — it feeds `useGuestCustomerInfo`'s memoised commit.
   */
  requiredFields?: ReadonlyArray<CustomerInfoField>;
}

/**
 * BUGS-IMPROVEMENTS-PLAN §C1.5.e — Takeaway info modal. Opens only for
 * users whose profile is missing one or more of name/email/phone (guests
 * always; logged-in users only when the field they need isn't on their
 * profile yet). Logged-in users with everything on file see no inputs
 * at all and never reach this modal — the `pickType('Takeaway')` branch
 * in `useOrderTypeFollowUp` skips it entirely.
 *
 * §C1.5.g additions: guests also see the benefits block + opt-in
 * inline registration. Submitting with the checkbox ticked fires
 * `POST /api/User/register/customer` in the background (option A:
 * verification-email path, this order proceeds as guest regardless).
 *
 * Footer button styles are shared with TableSelectionModal —
 * non-critical duplication; promote to design-system if a fourth modal
 * lands with the same footer shape.
 */
export default function TakeawayInfoModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  requiredFields,
}: Readonly<TakeawayInfoModalProps>) {
  const { t } = useTranslation();
  const guest = useGuestCustomerInfo({
    requiredFields: requiredFields ?? TAKEAWAY_REQUIRED_FIELDS,
    enabled: isOpen,
    source: 'takeaway_modal',
  });

  const handleConfirm = async () => {
    const committed = await guest.commit();
    if (committed === null) return;
    onConfirm();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? t('takeaway_info_title', 'Almost there — your details')}
      footer={
        <>
          <button
            type="button"
            className={tableModalStyles.secondaryButton}
            onClick={onClose}
            disabled={guest.isRegistering}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={tableModalStyles.primaryButton}
            onClick={handleConfirm}
            disabled={guest.isLoadingUser || guest.isRegistering}
          >
            {guest.isRegistering ? t('saving', 'Saving…') : t('confirm', 'Confirm')}
          </button>
        </>
      }
    >
      <GuestCustomerInfoFields
        value={guest.value}
        errors={guest.errors}
        visibleFields={guest.visibleFields}
        requiredFields={guest.requiredFields}
        showRegisterCta={guest.showRegisterCta}
        onChange={guest.setField}
        onBlur={guest.blurField}
        disabled={guest.isRegistering}
        wantsRegister={guest.wantsRegister}
        setWantsRegister={guest.setWantsRegister}
        registerValue={guest.registerValue}
        registerErrors={guest.registerErrors}
        onRegisterChange={guest.setRegisterField}
        onRegisterBlur={guest.blurRegisterField}
      />
    </BaseModal>
  );
}
