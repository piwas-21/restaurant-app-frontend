'use client';

import { useTranslation } from 'react-i18next';
import AlertDialog from '@/components/design-system/AlertDialog';
import BaseModal from '@/components/design-system/BaseModal';
import { OrderDto } from '@/types/order';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { formatOrderPrice } from '@/utils/orderDetailsFormatters';
import { orderCurrency } from '@/lib/cashierMoney';
import { gatewayNames, isHeldByGateway } from '@/utils/tenderCustody';
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
  refundTipAmount: string;
  setRefundTipAmount: (amount: string) => void;
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
  clearError: () => void;
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
  refundTipAmount,
  setRefundTipAmount,
  refundReason,
  setRefundReason,
  isRefunding,
  onRefundPayment,
  showSuccessModal,
  onSuccessClose,
  showCancelSuccessModal,
  onCancelSuccessClose,
  error,
  clearError,
}: OrderRefundResultDialogsProps) {
  const { t } = useTranslation();

  // S11. Mirrors the cashier dialog and the server: a gateway-captured tender is refunded in that
  // gateway's dashboard, so offering it here is a button that always fails.
  //
  // The NOTICE is derived from Completed tenders only, exactly as the cashier's is. A `Processing`
  // Stripe tender is money still in flight and a `Refunded` one is money already returned — telling
  // an admin to go and refund either in the dashboard is worse than saying nothing. The select
  // also stays limited to tenders that still accept their one supported refund event.
  const completedPayments = (order.payments ?? []).filter((p) => p.status === 'Completed');
  const selectablePayments = completedPayments.filter((payment) => !isHeldByGateway(payment));
  const gateways = gatewayNames(completedPayments);
  const selectedPaymentDto = selectablePayments.find((payment) => payment.id === selectedPayment);
  const refundableTipMinor = Math.max(
    0,
    (selectedPaymentDto?.tipMinor ?? 0) - (selectedPaymentDto?.refundedTipMinor ?? 0),
  );

  return (
    <>
      <AlertDialog
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setSelectedPayment(null);
          setRefundAmount('');
          setRefundTipAmount('0.00');
          setRefundReason('');
          clearError();
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
        <p className={styles.confirmModalMessage}>{t('cashier.refund_single_event_warning')}</p>
        {gateways.length > 0 && (
          <p className={styles.confirmModalMessage}>{t('gateway_refund_notice', { gateway: gateways.join(', ') })}</p>
        )}
        <div className={styles.formGroup}>
          <label htmlFor="paymentSelect">{t('select_payment', 'Select Payment')} *</label>
          <select
            id="paymentSelect"
            value={selectedPayment || ''}
            onChange={(event) => {
              const payment = selectablePayments.find((candidate) => candidate.id === event.target.value);
              setSelectedPayment(event.target.value || null);
              setRefundAmount(payment ? payment.amount.toFixed(2) : '');
              setRefundTipAmount(
                payment
                  ? (Math.max(0, (payment.tipMinor ?? 0) - (payment.refundedTipMinor ?? 0)) / 100).toFixed(2)
                  : '0.00',
              );
            }}
            className={styles.select}
          >
            <option value="">{t('select_payment_to_refund', '-- Select Payment --')}</option>
            {/* Nullish-coalesced above: AlertDialog evaluates its children on every render (even
                when closed), unlike the previous `{showRefundModal && (...)}` gate — so an order
                without a payments array must not crash the closed dialog. */}
            {selectablePayments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                {getPaymentMethodLabel(payment.paymentMethod, t)} - {formatOrderPrice(payment.amount)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="refundAmount">
            {t('refund_amount', 'Refund Amount')} ({orderCurrency(order)}) *
          </label>
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
        {refundableTipMinor > 0 && (
          <div className={styles.formGroup}>
            <label htmlFor="refundTipAmount">
              {t('cashier.refund_tip_amount')} ({orderCurrency(order)})
            </label>
            <input
              id="refundTipAmount"
              type="number"
              step="0.01"
              min="0"
              max={(refundableTipMinor / 100).toFixed(2)}
              value={refundTipAmount}
              onChange={(event) => setRefundTipAmount(event.target.value)}
              placeholder="0.00"
              className={styles.input}
            />
            <small>
              {t('cashier.refund_tip_note')}{' '}
              {t('cashier.refund_tip_exceeds_payment', {
                max: `${(refundableTipMinor / 100).toFixed(2)} ${orderCurrency(order)}`,
              })}
            </small>
          </div>
        )}
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
