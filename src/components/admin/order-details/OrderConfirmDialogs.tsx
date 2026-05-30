'use client';

import { useTranslation } from 'react-i18next';
import { Ban, Clock, Loader2 } from 'lucide-react';
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
 * The cancel-order and confirm-with-delay dialogs of the OrderDetailsModal. Extracted
 * verbatim from OrderDetailsModal (Sprint 6 god-file decomposition).
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
      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>
              <Ban size={20} />
              {t('cancel_order', 'Cancel Order')}
            </h3>
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
            <div className={styles.confirmModalActions}>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                  setError('');
                }}
                className={styles.cancelButton}
                disabled={isCancelling}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button onClick={onCancelOrder} className={styles.confirmCancelButton} disabled={isCancelling}>
                {isCancelling ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    {t('cancelling', 'Cancelling...')}
                  </>
                ) : (
                  <>
                    <Ban size={18} />
                    {t('cancel_order', 'Cancel Order')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm with Delay Modal */}
      {showConfirmDelayModal && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>
              <Clock size={20} />
              {t('confirm_with_delay', 'Confirm with Delay')}
            </h3>
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
            <div className={styles.confirmModalActions}>
              <button
                onClick={() => {
                  setShowConfirmDelayModal(false);
                  setDelayMinutes(15);
                  setError('');
                }}
                className={styles.cancelButton}
                disabled={isConfirming}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button onClick={() => onConfirmOrder(true)} className={styles.confirmButton} disabled={isConfirming}>
                {isConfirming ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    {t('confirming', 'Confirming...')}
                  </>
                ) : (
                  <>✓ {t('confirm_order', 'Confirm Order')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
