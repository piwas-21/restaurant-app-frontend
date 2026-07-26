'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import TableSelector from '@/components/checkout/TableSelector';
import { useGuestCustomerInfo } from '@/hooks/order/useGuestCustomerInfo';
import GuestCustomerInfoFields from './GuestCustomerInfoFields';
import styles from './TableSelectionModal.module.css';

// Order-type floor for Dine-In: only name+email are operationally required
// (the customer is at the restaurant). The admin `checkout_contact` config
// merges on top (`mergeContactFieldRules`) — it can surface phone as optional
// or required here, but never remove name/email. Module-level constant —
// frozen at load, so the reference is stable across renders (inlining the
// array would allocate per render and defeat the hook's memoised commit).
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
  // frontend #208: Confirm used to be `disabled` while no table was picked, so tapping it did
  // nothing at all — a disabled button does not even fire a click, and the guest got no hint that
  // a table was what was missing. It stays enabled and explains itself instead.
  const [showTableRequired, setShowTableRequired] = useState(false);
  const tablePickerRef = useRef<HTMLDivElement>(null);
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
    if (isOpen) {
      setSelected(initialTable);
      setShowTableRequired(false);
    }
  }, [isOpen, initialTable]);

  const selectTable = (table: string) => {
    setSelected(table);
    setShowTableRequired(false);
  };

  const handleConfirm = async () => {
    if (!selected) {
      setShowTableRequired(true);
      // The picker can be scrolled out of view in a long modal — say what is wrong AND take the
      // guest to it. `tabIndex={-1}` makes the wrapper focusable so screen readers land there too.
      tablePickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tablePickerRef.current?.focus({ preventScroll: true });
      return;
    }
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
          <button type="button" className={styles.primaryButton} onClick={handleConfirm} disabled={guest.isRegistering}>
            {guest.isRegistering ? t('saving', 'Saving…') : t('confirm', 'Confirm')}
          </button>
        </>
      }
    >
      <div
        ref={tablePickerRef}
        tabIndex={-1}
        aria-describedby={showTableRequired ? 'table-required-hint' : undefined}
        className={styles.tablePicker}
      >
        <TableSelector selectedTable={selected} onTableSelect={selectTable} />
      </div>
      {showTableRequired && (
        <p id="table-required-hint" className={styles.requiredHint} role="alert">
          {t('table_required_hint', 'Choose a table to continue.')}
        </p>
      )}
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
