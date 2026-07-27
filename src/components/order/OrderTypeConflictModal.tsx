'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { orderTypeLabel, orderTypeListLabel } from '@/utils/orderTypeLabels';
import type { PendingOrderTypeSwitch } from '@/hooks/order/useOrderTypeSwitch';
import tableModalStyles from './TableSelectionModal.module.css';
import styles from './OrderTypeConflictModal.module.css';

interface OrderTypeConflictModalProps {
  /** Null when nothing is pending — the modal closes on its own. */
  pending: PendingOrderTypeSwitch | null;
  isApplying: boolean;
  /** i18n key for a failed removal, or null. The dialog stays open and says so. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The itemized confirm before an order-type switch removes lines (§4.4): *"Switching to Dine In
 * removes: Dürüm ×1. Continue / Cancel."*
 *
 * Both templates by construction — it reuses the shared modal button classes and the
 * `--modal-body-*` token family craft already defines, rather than a per-template component
 * override (§4.5). There is no craft `surfaces.ts` entry to add.
 *
 * It renders `conflicts`, which the server has always named correctly (they come from
 * `FindConflictsAsync`'s own product query). It deliberately does NOT consume the switch payload's
 * echoed `basket` — the one field that used to come back nameless, plan §9.11 — and re-reads the
 * cart through `syncBasket` instead, which is why backend #236 was not a prerequisite here.
 */
export default function OrderTypeConflictModal({
  pending,
  isApplying,
  error,
  onConfirm,
  onCancel,
}: Readonly<OrderTypeConflictModalProps>) {
  const { t, i18n } = useTranslation();

  // BaseModal evaluates its children even while closed, so every read below has to survive a null
  // `pending` — the crash that the #93→#96 refund dialog shipped by assuming otherwise.
  const targetLabel = pending ? orderTypeLabel(pending.orderType, t) : '';

  // BaseModal has FOUR exits — Cancel, ESC, backdrop and the header X — and `disableEscapeClose` /
  // `disableBackdropClose` cover only two of them; the X is an unconditional `onClick={onClose}`.
  // Guarding the handler itself closes all four at once, which matters because `confirm()` has
  // already captured `pending` in its closure: dismissing mid-apply cleared the dialog while the
  // removal went on to complete and commit the type anyway — a cancel that does not cancel.
  const guardedCancel = () => {
    if (!isApplying) onCancel();
  };

  return (
    <BaseModal
      isOpen={pending !== null}
      onClose={guardedCancel}
      title={t('order_type_conflict_title', 'Some items are not available')}
      // Belt to the guard's braces: with these set, ESC and a backdrop click do not even attempt a
      // dismiss that would be swallowed.
      disableBackdropClose={isApplying}
      disableEscapeClose={isApplying}
      footer={
        <>
          <button
            type="button"
            className={tableModalStyles.secondaryButton}
            onClick={guardedCancel}
            disabled={isApplying}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button type="button" className={tableModalStyles.primaryButton} onClick={onConfirm} disabled={isApplying}>
            {isApplying
              ? t('order_type_conflict_removing', 'Removing…')
              : t('order_type_conflict_confirm', 'Remove and continue')}
          </button>
        </>
      }
    >
      <p className={styles.intro}>
        {t('order_type_conflict_intro', 'Switching to {{orderType}} removes these items from your order:', {
          orderType: targetLabel,
        })}
      </p>

      {/* `role="list"` is not redundant here: Safari/VoiceOver drops list semantics from a `<ul>`
          carrying `list-style: none`, and the guest is being asked to consent to a deletion — how
          many items are in the list is part of the question. */}
      <ul className={styles.list} role="list">
        {pending?.conflicts.map((conflict) => (
          <li key={conflict.basketItemId} className={styles.item}>
            <span className={styles.itemName}>
              {conflict.productName} × {conflict.quantity}
            </span>
            {conflict.allowedOrderTypes.length > 0 && (
              <span className={styles.itemReason}>
                {t('availability_only_for', '{{orderTypes}} only', {
                  orderTypes: orderTypeListLabel(conflict.allowedOrderTypes, t, i18n.language || 'en'),
                })}
              </span>
            )}
          </li>
        ))}
      </ul>

      {error ? (
        <p className={styles.error} role="alert">
          {t(error, 'Those items could not be removed. Your order is unchanged — please try again.')}
        </p>
      ) : (
        <p className={styles.keepHint}>{t('order_type_conflict_keep', 'Cancel to keep your order as it is.')}</p>
      )}
    </BaseModal>
  );
}
