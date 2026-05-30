'use client';

import { useTranslation } from 'react-i18next';
import AlertDialog from '@/components/design-system/AlertDialog';
import styles from '../OrderDetailsModal.module.css';

interface OrderConfirmDialogsProps {
  // Cancel-order dialog
  showCancelModal: boolean;
  setShowCancelModal: (open: boolean) => void;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  isCancelling: boolean;
  onCancelOrder: () => void;
  // Confirm-with-delay dialog
  showConfirmDelayModal: boolean;
  setShowConfirmDelayModal: (open: boolean) => void;
  delayMinutes: number;
  setDelayMinutes: (minutes: number) => void;
  isConfirming: boolean;
  onConfirmOrder: (withDelay: boolean) => void;
  // Shared
  error: string;
  setError: (error: string) => void;
}

const DELAY_PRESETS = [5, 10, 15, 20, 30];

/**
 * The cancel-order and confirm-with-delay dialogs of the OrderDetailsModal, built on the
 * design-system {@link AlertDialog} (Sprint 5/6). The form bodies (reason, delay selector)
 * are passed as the dialog content; AlertDialog owns the overlay, title, and Cancel/Confirm
 * actions (with the in-flight spinner). Validation handlers keep the dialog open on error.
 */
export default function OrderConfirmDialogs({
  showCancelModal,
  setShowCancelModal,
  cancelReason,
  setCancelReason,
  isCancelling,
  onCancelOrder,
  showConfirmDelayModal,
  setShowConfirmDelayModal,
  delayMinutes,
  setDelayMinutes,
  isConfirming,
  onConfirmOrder,
  error,
  setError,
}: OrderConfirmDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <AlertDialog
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
          setError('');
        }}
        onConfirm={onCancelOrder}
        title={t('cancel_order', 'Cancel Order')}
        variant="danger"
        confirmLabel={t('cancel_order', 'Cancel Order')}
        isConfirming={isCancelling}
      >
        <p className={styles.confirmModalMessage}>
          {t('cancel_order_warning', 'Are you sure you want to cancel this order? This action cannot be undone.')}
        </p>
        <div className={styles.formGroup}>
          <label htmlFor="cancelReason">{t('cancellation_reason', 'Cancellation Reason')} *</label>
          <textarea
            id="cancelReason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('cancellation_reason_placeholder', 'Enter reason for cancellation...')}
            className={styles.textarea}
            rows={4}
          />
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </AlertDialog>

      <AlertDialog
        isOpen={showConfirmDelayModal}
        onClose={() => {
          setShowConfirmDelayModal(false);
          setDelayMinutes(15);
          setError('');
        }}
        onConfirm={() => onConfirmOrder(true)}
        title={t('confirm_with_delay', 'Confirm with Delay')}
        variant="info"
        confirmLabel={t('confirm_order', 'Confirm Order')}
        isConfirming={isConfirming}
      >
        <p className={styles.confirmModalMessage}>
          {t('confirm_delay_message', 'Select the estimated preparation time for this order.')}
        </p>
        <div className={styles.formGroup}>
          <label htmlFor="delayMinutes">{t('preparation_time', 'Preparation Time')} *</label>
          <div className={styles.delayOptions}>
            {DELAY_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDelayMinutes(minutes)}
                className={`${styles.delayOption} ${delayMinutes === minutes ? styles.delayOptionActive : ''}`}
              >
                {minutes} {t('minutes', 'min')}
              </button>
            ))}
          </div>
          <input
            id="delayMinutes"
            type="number"
            min="1"
            max="120"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 15)}
            className={styles.input}
            placeholder={t('custom_minutes', 'Custom minutes')}
          />
        </div>
        {error && <div className={styles.errorMessage}>{error}</div>}
      </AlertDialog>
    </>
  );
}
