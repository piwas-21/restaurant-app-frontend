/**
 * Delete Confirmation Modal
 *
 * Confirmation dialog for deleting orders with safety checks
 */

import { formatPlainCurrency } from '@/utils/currency';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { AlertTriangle } from 'lucide-react';
import styles from './DeleteConfirmationModal.module.css';

interface DeleteConfirmationModalProps {
  order: OrderDto;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirmationModal({ order, onClose, onConfirm }: DeleteConfirmationModalProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmValid = confirmText === order.orderNumber;

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // IGNORED ON PURPOSE — and specifically NOT a place to add a second message.
      //
      // Traced end to end rather than assumed, because "reported elsewhere" is the claim every
      // swallowed failure makes. The only consumer is `AdminOrdersModals`, whose `onConfirm` is
      // the orders page's `onConfirmDelete` → `useAdminOrderMutations.handleDeleteOrder`, and that
      // function has its own bound catch which enqueues
      // `getErrorMessage(err) ?? t('order_delete_failed')`. It does not rethrow — so this arm is
      // currently UNREACHABLE, and surfacing here would double-report a failure the user has
      // already been shown.
      //
      // It is kept rather than deleted because the prop's type is `() => Promise<void>`: a future
      // consumer that rejects would otherwise leave an unhandled rejection on the click path, and
      // resetting `isDeleting` is the correct response to a rejection (the button un-sticks and
      // the dialog stays open). Retained as a contract guard, not as a live path.
      //
      // Known, deliberately not changed here: because the producer resolves on failure, `onClose()`
      // above runs and the dialog closes even when the delete was refused. The red toast still
      // reports it. Making the dialog stay open means changing the producer to rethrow, which is a
      // behaviour change across the orders page rather than an error-surfacing fix.
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmValid && !isDeleting) {
      // handleConfirm has its own try/catch (resets isDeleting); fire-and-forget.
      void handleConfirm();
    } else if (e.key === 'Escape' && !isDeleting) {
      onClose();
    }
  };

  const handleOverlayClick = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.warningIcon}>
          <AlertTriangle size={48} />
        </div>

        <h2>{t('delete_order_confirm', 'Delete Order?')}</h2>

        <div className={styles.orderInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>{t('order_number', 'Order Number')}:</span>
            <span className={styles.value}>{order.orderNumber}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>{t('customer_name', 'Customer')}:</span>
            <span className={styles.value}>{order.customerName || 'N/A'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>{t('total', 'Total')}:</span>
            <span className={styles.value}>{formatPlainCurrency(order.total)}</span>
          </div>
        </div>

        <p className={styles.warningText}>
          {t('delete_order_warning', 'This action cannot be undone. The order will be permanently deleted.')}
        </p>

        <div className={styles.confirmSection}>
          <label htmlFor="confirm-input" className={styles.confirmLabel}>
            {t('confirm_delete_order', 'Type the order number to confirm deletion')}:
          </label>
          <input
            id="confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={order.orderNumber}
            className={styles.confirmInput}
            autoFocus
            disabled={isDeleting}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button type="button" onClick={onClose} className={styles.cancelButton} disabled={isDeleting}>
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={styles.deleteButton}
            disabled={!isConfirmValid || isDeleting}
          >
            {isDeleting ? t('deleting', 'Deleting...') : t('delete_order', 'Delete Order')}
          </button>
        </div>
      </div>
    </div>
  );
}
