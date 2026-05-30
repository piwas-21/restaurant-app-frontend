'use client';

import { useTranslation } from 'react-i18next';
import { DollarSign, Loader2 } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { formatOrderPrice } from '@/utils/orderDetailsFormatters';
import styles from '../OrderDetailsModal.module.css';

interface OrderRefundResultDialogsProps {
  order: OrderDto;
  // Refund dialog
  showRefundModal: boolean;
  setShowRefundModal: (open: boolean) => void;
  selectedPayment: string | null;
  setSelectedPayment: (id: string | null) => void;
  refundAmount: string;
  setRefundAmount: (amount: string) => void;
  refundReason: string;
  setRefundReason: (reason: string) => void;
  isRefunding: boolean;
  onRefundPayment: () => void;
  // Success dialogs
  showSuccessModal: boolean;
  onSuccessClose: () => void;
  showCancelSuccessModal: boolean;
  onCancelSuccessClose: () => void;
  // Shared
  error: string;
  setError: (error: string) => void;
}

/**
 * The refund-payment dialog and the order-confirmed / order-cancelled success dialogs of
 * the OrderDetailsModal. Extracted verbatim from OrderDetailsModal (Sprint 6 god-file decomposition).
 */
export default function OrderRefundResultDialogs({
  order,
  showRefundModal,
  setShowRefundModal,
  selectedPayment,
  setSelectedPayment,
  refundAmount,
  setRefundAmount,
  refundReason,
  setRefundReason,
  isRefunding,
  onRefundPayment,
  showSuccessModal,
  onSuccessClose,
  showCancelSuccessModal,
  onCancelSuccessClose,
  error,
  setError,
}: OrderRefundResultDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Refund Payment Modal */}
      {showRefundModal && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <h3 className={styles.confirmModalTitle}>
              <DollarSign size={20} />
              {t('refund_payment', 'Refund Payment')}
            </h3>
            <p className={styles.confirmModalMessage}>
              {t('refund_payment_warning', 'This will process a refund for the selected payment.')}
            </p>
            <div className={styles.formGroup}>
              <label htmlFor="paymentSelect">{t('select_payment', 'Select Payment')} *</label>
              <select
                id="paymentSelect"
                value={selectedPayment || ''}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className={styles.select}
              >
                <option value="">{t('select_payment_to_refund', '-- Select Payment --')}</option>
                {order.payments.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    {getPaymentMethodLabel(payment.paymentMethod)} - {formatOrderPrice(payment.amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="refundAmount">{t('refund_amount', 'Refund Amount')} (CHF) *</label>
              <input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="refundReason">{t('refund_reason', 'Refund Reason')} *</label>
              <textarea
                id="refundReason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('refund_reason_placeholder', 'Enter reason for refund...')}
                className={styles.textarea}
                rows={4}
              />
            </div>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <div className={styles.confirmModalActions}>
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedPayment(null);
                  setRefundAmount('');
                  setRefundReason('');
                  setError('');
                }}
                className={styles.cancelButton}
                disabled={isRefunding}
              >
                {t('cancel', 'Cancel')}
              </button>
              <button onClick={onRefundPayment} className={styles.confirmRefundButton} disabled={isRefunding}>
                {isRefunding ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    {t('refunding', 'Refunding...')}
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    {t('refund_payment', 'Refund Payment')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <div className={styles.successIcon}>✓</div>
            <h3 className={styles.confirmModalTitle}>
              {t('order_confirmed_successfully', 'Order confirmed successfully')}
            </h3>
            <p className={styles.confirmModalMessage}>
              {t('order_confirmed_message', 'The customer will receive a confirmation email shortly.')}
            </p>
            <div className={styles.confirmModalActions}>
              <button onClick={onSuccessClose} className={styles.confirmButton}>
                {t('close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Success Modal */}
      {showCancelSuccessModal && (
        <div className={styles.confirmModal}>
          <div className={styles.confirmModalContent}>
            <div className={styles.successIcon}>✓</div>
            <h3 className={styles.confirmModalTitle}>
              {t('order_cancelled_successfully', 'Order cancelled successfully')}
            </h3>
            <p className={styles.confirmModalMessage}>
              {t('order_cancelled_message', 'The order has been cancelled.')}
            </p>
            <div className={styles.confirmModalActions}>
              <button onClick={onCancelSuccessClose} className={styles.confirmButton}>
                {t('close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
