'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import TableSelector from '@/components/checkout/TableSelector';
import { useGuestCustomerInfo } from '@/hooks/order/useGuestCustomerInfo';
import GuestCustomerInfoFields from './GuestCustomerInfoFields';
import styles from './TableSelectionModal.module.css';

// Module-level constant — frozen at load, so the reference is stable across
// renders. Inlining `['name', 'email']` at the call site would allocate a
// new array per render and defeat `useGuestCustomerInfo`'s
// `useCallback(commit, [..., requiredFields])` memoisation.
const DINEIN_REQUIRED_FIELDS = ['name', 'email'] as const;

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the chosen table number when the user confirms. */
  onConfirm: (table: string) => void;
  /** Pre-selected table (e.g. when re-opening from the sticky-header Change). */
  initialTable?: string;
}

/**
 * BUGS-IMPROVEMENTS-PLAN §C1.5.b — dine-in follow-up modal. Wraps the
 * existing `TableSelector` (which fetches /api/Tables and handles the
 * occupied/reserved/full UX) inside `BaseModal`, then takes a confirm
 * step before applying the choice to the order context.
 *
 * Pre-selection is intentional: if the user landed here from the sticky
 * header's "Change" affordance and the order context already has a table,
 * highlight it so the user sees their current pick. Picking a different
 * card just updates the local highlight; nothing commits until Confirm.
 */
export default function TableSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  initialTable = '',
}: TableSelectionModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(initialTable);
  // Phone optional for DineIn — matches the pre-existing customer-info
  // schema (the customer is at the restaurant; phone is a nice-to-have,
  // not required to take the order).
  const guest = useGuestCustomerInfo({
    requiredFields: DINEIN_REQUIRED_FIELDS,
    enabled: isOpen,
    source: 'dinein_modal',
  });

  // Re-sync local state when the modal re-opens with a different initial
  // (e.g. after the user changed via sticky header → welcome → reopen).
  useEffect(() => {
    if (isOpen) setSelected(initialTable);
  }, [isOpen, initialTable]);

  const handleConfirm = async () => {
    if (!selected) return;
    if (guest.visibleFields.length > 0 || guest.wantsRegister) {
      const committed = await guest.commit();
      if (committed === null) return;
    }
    onConfirm(selected);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('table_selection_title', 'Select your table')}
      footer={
        <>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={guest.isRegistering}>
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleConfirm}
            disabled={!selected || guest.isRegistering}
          >
            {guest.isRegistering ? t('saving', 'Saving…') : t('confirm', 'Confirm')}
          </button>
        </>
      }
    >
      <TableSelector selectedTable={selected} onTableSelect={setSelected} />
      <GuestCustomerInfoFields
        value={guest.value}
        errors={guest.errors}
        visibleFields={guest.visibleFields}
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
