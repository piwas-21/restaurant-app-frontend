'use client';

import { useTranslation } from 'react-i18next';
import { CreditCard, Printer } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { exportOrderToPDF, exportKitchenItemsToPDF } from '@/utils/pdfExportUtils';
import styles from '../OrderDetails.module.css';

interface OrderDetailsRightColumnProps {
  order: OrderDto;
}

/**
 * The right column of the cashier OrderDetails: order summary, payment status/list, and print
 * actions. Extracted verbatim from OrderDetails (Sprint 4/6 god-file decomposition).
 */
export default function OrderDetailsRightColumn({ order }: OrderDetailsRightColumnProps) {
  const { t } = useTranslation();

  const hasFrontKitchenItems = order?.items?.some((item) => item.kitchenType === 'FrontKitchen');
  const hasBackKitchenItems = order?.items?.some((item) => item.kitchenType === 'BackKitchen');

  return (
    <div className={styles.rightColumn}>
      {/* Order Summary */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardHeader}>{t('order_summary', 'Order Summary')}</h3>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{t('subtotal', 'Subtotal')}</span>
          <span className={styles.summaryValue}>CHF {order.subTotal?.toFixed(2)}</span>
        </div>
        {order.tax > 0 && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{t('tax', 'Tax')}</span>
            <span className={styles.summaryValue}>CHF {order.tax?.toFixed(2)}</span>
          </div>
        )}
        {order.deliveryFee > 0 && (
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{t('delivery_fee', 'Delivery Fee')}</span>
            <span className={styles.summaryValue}>CHF {order.deliveryFee?.toFixed(2)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className={styles.summaryRow}>
            <span className={`${styles.summaryLabel} ${styles.discountText}`}>{t('order_discount', 'Discount')}</span>
            <span className={`${styles.summaryValue} ${styles.discountText}`}>-CHF {order.discount?.toFixed(2)}</span>
          </div>
        )}
        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
          <span className={styles.summaryLabel}>{t('order_total', 'Total')}</span>
          <span className={styles.summaryValue}>CHF {order.total?.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Information */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardHeader}>
          <CreditCard size={18} />
          {t('payment_status', 'Payment Status')}
        </h3>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{t('cashier.total_paid', 'Total Paid')}</span>
          <span className={styles.summaryValue}>CHF {order.totalPaid?.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{t('cashier.remaining', 'Remaining')}</span>
          <span
            className={styles.summaryValue}
            style={{ color: order.remainingAmount! > 0 ? 'var(--status-danger)' : 'var(--status-confirmed)' }}
          >
            CHF {Math.abs(order.remainingAmount || 0).toFixed(2)}
          </span>
        </div>

        {/* Payment List */}
        {order.payments && order.payments.length > 0 && (
          <div className={styles.paymentList}>
            {order.payments.map((payment, idx) => (
              <div key={idx} className={styles.paymentCard}>
                <div className={styles.paymentCardHeader}>
                  <div>
                    <div className={styles.paymentMethod}>{getPaymentMethodLabel(payment.paymentMethod)}</div>
                    <div className={styles.paymentDate}>
                      {payment.paymentDate ? new Date(payment.paymentDate).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div className={styles.paymentAmount}>CHF {payment.amount?.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print Actions */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardHeader}>
          <Printer size={18} />
          {t('cashier.print_actions', 'Print Actions')}
        </h3>
        <div className={styles.actionBarGrid}>
          <button
            className={`${styles.actionButton} ${styles.actionButtonInfo}`}
            onClick={() => exportOrderToPDF(order, t)}
          >
            <Printer size={16} />
            {t('cashier.print_bill', 'Print Bill')}
          </button>
          {hasFrontKitchenItems && (
            <button
              className={`${styles.actionButton} ${styles.actionButtonInfo}`}
              onClick={() => exportKitchenItemsToPDF(order, 'FrontKitchen', t)}
            >
              <Printer size={16} />
              {t('print_front_kitchen', 'Front Kitchen')}
            </button>
          )}
          {hasBackKitchenItems && (
            <button
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              onClick={() => exportKitchenItemsToPDF(order, 'BackKitchen', t)}
            >
              <Printer size={16} />
              {t('print_back_kitchen', 'Back Kitchen')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
