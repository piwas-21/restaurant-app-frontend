'use client';

import { useTranslation } from 'react-i18next';
import AlertDialog from '@/components/design-system/AlertDialog';
import BaseModal from '@/components/design-system/BaseModal';
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
 * The refund-payment dialog (design-system {@link AlertDialog}) and the order-confirmed /
 * order-cancelled acknowledgement dialogs (design-system {@link BaseModal}) of the
 * OrderDetailsModal (Sprint 5/6).
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
      <AlertDialog
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setSelectedPayment(null);
          setRefundAmount('');
          setRefundReason('');
          setError('');
        }}
        onConfirm={onRefundPayment}
        title={t('refund_payment', 'Refund Payment')}
        variant="danger"
        confirmLabel={t('refund_payment', 'Refund Payment')}
        isConfirming={isRefunding}
      >
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
            {/* Optional-chain: AlertDialog evaluates its children on every render (even when
                closed), unlike the previous `{showRefundModal && (...)}` gate — so guard against
                an order without a payments array to avoid a crash on the closed dialog. */}
            {order.payments?.map((payment) => (
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
      </AlertDialog>

      <BaseModal
        isOpen={showSuccessModal}
        onClose={onSuccessClose}
        title={t('order_confirmed_successfully', 'Order confirmed successfully')}
        footer={
          <button onClick={onSuccessClose} className={styles.confirmButton}>
            {t('close', 'Close')}
          </button>
        }
      >
        <div className={styles.successIcon}>✓</div>
        <p className={styles.confirmModalMessage}>
          {t('order_confirmed_message', 'The customer will receive a confirmation email shortly.')}
        </p>
      </BaseModal>

      <BaseModal
        isOpen={showCancelSuccessModal}
        onClose={onCancelSuccessClose}
        title={t('order_cancelled_successfully', 'Order cancelled successfully')}
        footer={
          <button onClick={onCancelSuccessClose} className={styles.confirmButton}>
            {t('close', 'Close')}
          </button>
        }
      >
        <div className={styles.successIcon}>✓</div>
        <p className={styles.confirmModalMessage}>{t('order_cancelled_message', 'The order has been cancelled.')}</p>
      </BaseModal>
    </>
  );
}
