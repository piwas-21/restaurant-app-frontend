'use client';

import { useTranslation } from 'react-i18next';
import { Ban, Clock, Loader2, DollarSign } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { useOrderDetailsActions } from '@/hooks/admin/useOrderDetailsActions';
import OrderDetailsHeader from './order-details/OrderDetailsHeader';
import OrderDetailsInfo from './order-details/OrderDetailsInfo';
import OrderDetailsSummary from './order-details/OrderDetailsSummary';
import OrderConfirmDialogs from './order-details/OrderConfirmDialogs';
import OrderRefundResultDialogs from './order-details/OrderRefundResultDialogs';
import styles from './OrderDetailsModal.module.css';

interface OrderDetailsModalProps {
  order: OrderDto;
  onClose: () => void;
  onOrderUpdated?: (updatedOrder: OrderDto) => void;
}

/**
 * Admin order-details modal. Orchestrates the header, the info/summary content sections,
 * the action footer, and the cancel/confirm/refund/success dialogs — all extracted into
 * sub-components, with state + handlers in useOrderDetailsActions (Sprint 6 god-file
 * decomposition). The outer overlay keeps its `id="order-details-print"` structure, which
 * the print stylesheet targets.
 */
export default function OrderDetailsModal({ order, onClose, onOrderUpdated }: OrderDetailsModalProps) {
  const { t } = useTranslation();
  const actions = useOrderDetailsActions(order, onClose, onOrderUpdated);

  return (
    <div className={styles.overlay} onClick={onClose} id="order-details-print">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <OrderDetailsHeader
          order={order}
          showExportMenu={actions.showExportMenu}
          onToggleExportMenu={() => actions.setShowExportMenu(!actions.showExportMenu)}
          onPrint={actions.handlePrint}
          onExport={actions.handleExport}
          onExportPDF={actions.handleExportPDF}
          onClose={onClose}
        />

        {/* Content */}
        <div className={styles.content}>
          <OrderDetailsInfo order={order} />
          <OrderDetailsSummary order={order} />
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            {actions.canConfirmOrder() && (
              <>
                <button
                  onClick={() => actions.handleConfirmOrder(false)}
                  className={styles.confirmButton}
                  disabled={actions.isConfirming}
                >
                  {actions.isConfirming ? (
                    <>
                      <Loader2 size={18} className={styles.spinner} />
                      {t('confirming', 'Confirming...')}
                    </>
                  ) : (
                    <>✓ {t('confirm_order', 'Confirm Order')}</>
                  )}
                </button>
                <button
                  onClick={() => actions.setShowConfirmDelayModal(true)}
                  className={styles.confirmDelayButton}
                  disabled={actions.isConfirming}
                >
                  <Clock size={18} />
                  {t('confirm_with_delay', 'Confirm with Delay')}
                </button>
              </>
            )}
            {actions.canCancelOrder() && (
              <button onClick={() => actions.setShowCancelModal(true)} className={styles.cancelOrderButton}>
                <Ban size={18} />
                {t('cancel_order', 'Cancel Order')}
              </button>
            )}
            {order.payments && order.payments.length > 0 && order.isFullyPaid && (
              <button onClick={() => actions.setShowRefundModal(true)} className={styles.refundButton}>
                <DollarSign size={18} />
                {t('refund_payment', 'Refund Payment')}
              </button>
            )}
          </div>
          <button onClick={onClose} className={styles.closeButtonFooter}>
            {t('close', 'Close')}
          </button>
        </div>

        <OrderConfirmDialogs
          showCancelModal={actions.showCancelModal}
          setShowCancelModal={actions.setShowCancelModal}
          cancelReason={actions.cancelReason}
          setCancelReason={actions.setCancelReason}
          isCancelling={actions.isCancelling}
          onCancelOrder={actions.handleCancelOrder}
          showConfirmDelayModal={actions.showConfirmDelayModal}
          setShowConfirmDelayModal={actions.setShowConfirmDelayModal}
          delayMinutes={actions.delayMinutes}
          setDelayMinutes={actions.setDelayMinutes}
          isConfirming={actions.isConfirming}
          onConfirmOrder={actions.handleConfirmOrder}
          error={actions.error}
          setError={actions.setError}
        />

        <OrderRefundResultDialogs
          order={order}
          showRefundModal={actions.showRefundModal}
          setShowRefundModal={actions.setShowRefundModal}
          selectedPayment={actions.selectedPayment}
          setSelectedPayment={actions.setSelectedPayment}
          refundAmount={actions.refundAmount}
          setRefundAmount={actions.setRefundAmount}
          refundReason={actions.refundReason}
          setRefundReason={actions.setRefundReason}
          isRefunding={actions.isRefunding}
          onRefundPayment={actions.handleRefundPayment}
          showSuccessModal={actions.showSuccessModal}
          onSuccessClose={actions.handleSuccessClose}
          showCancelSuccessModal={actions.showCancelSuccessModal}
          onCancelSuccessClose={actions.handleCancelSuccessClose}
          error={actions.error}
          setError={actions.setError}
        />
      </div>
    </div>
  );
}
