'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import BaseModal from '@/components/design-system/BaseModal';
import OrderTypeToggle from './OrderTypeToggle';
import tableModalStyles from './TableSelectionModal.module.css';

interface EditOrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fired with the picked type. The host wires this to
   * `useOrderTypeFollowUp().pickType`, which commits the type and opens its
   * detail modal (table number / delivery address) — so this modal closes as
   * the follow-up state moves off 'ordertype'.
   */
  onPick: (type: OrderType) => void;
}

/**
 * Review-page "Edit Order Details" editor: a small modal wrapping the shared
 * order-type toggle so the user can switch Dine In / Takeaway / Delivery in
 * place. Picking a type hands off to the detail modal; contact info is edited
 * separately via "Edit Customer Information". Fixes the bug where "Edit Order
 * Details" opened the takeaway contact modal (both Edit buttons shared one
 * handler that only re-opened the current type's follow-up).
 */
export default function EditOrderTypeModal({ isOpen, onClose, onPick }: Readonly<EditOrderTypeModalProps>) {
  const { t } = useTranslation();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('edit_order_type_title', 'Change order type')}
      footer={
        <button type="button" className={tableModalStyles.secondaryButton} onClick={onClose}>
          {t('cancel', 'Cancel')}
        </button>
      }
    >
      <OrderTypeToggle onPick={onPick} />
    </BaseModal>
  );
}
