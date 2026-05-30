'use client';

import { useTranslation } from 'react-i18next';
import { CreditCard, Clock, FileText } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { getPaymentBadgeClasses } from '@/utils/orderStatusStyles';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { formatOrderPrice, formatOrderDate } from '@/utils/orderDetailsFormatters';
import styles from '../OrderDetailsModal.module.css';

interface OrderDetailsSummaryProps {
  order: OrderDto;
}

/**
 * Order summary, payment details, notes and status-history sections of the
 * OrderDetailsModal. Extracted verbatim from OrderDetailsModal (Sprint 6 god-file decomposition).
 */
export default function OrderDetailsSummary({ order }: OrderDetailsSummaryProps) {
  const { t } = useTranslation();

  const translateTimelineNotes = (notes?: string) => {
    if (!notes) return null;

    // Check for known translatable notes
    const knownNotes: { [key: string]: string } = {
      'Order created': t('order_created', 'Order created'),
      'Order cancelled': t('order_cancelled', 'Order cancelled'),
      'Order completed': t('order_completed', 'Order completed'),
      'Status changed': t('status_changed', 'Status changed'),
      'Payment received': t('payment_received', 'Payment received'),
    };

    // Return translated version if known, otherwise return original
    return knownNotes[notes] || notes;
  };

  const formatChangedBy = (changedBy?: string) => {
    if (!changedBy) return null;

    // Check if it's a GUID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(changedBy)) {
      // It's a user ID, show "System" instead
      return t('system', 'System');
    }

    // Otherwise, it's likely a username or email, display as-is
    return changedBy;
  };

  return (
    <>
      {/* Order Summary Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <CreditCard size={18} />
          {t('order_summary', 'Order Summary')}
        </h3>
        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>{t('subtotal', 'Subtotal')}</span>
            <span>{formatOrderPrice(order.subTotal)}</span>
          </div>

          {order.discount > 0 && (
            <div className={`${styles.summaryRow} ${styles.discount}`}>
              <span>{t('promo_discount', 'Promo Discount')}</span>
              <span>-{formatOrderPrice(order.discount)}</span>
            </div>
          )}

          {order.hasUserLimitDiscount && order.userLimitAmount > 0 && (
            <div className={`${styles.summaryRow} ${styles.discount}`}>
              <span>{t('user_limit_discount', 'User Limit Discount')}</span>
              <span>-{formatOrderPrice(order.userLimitAmount)}</span>
            </div>
          )}

          {order.deliveryFee > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('delivery_fee', 'Delivery Fee')}</span>
              <span>{formatOrderPrice(order.deliveryFee)}</span>
            </div>
          )}

          <div className={styles.summaryRow}>
            <span>{t('tax', 'Tax')}</span>
            <span>{formatOrderPrice(order.tax)}</span>
          </div>

          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span>{t('total', 'Total')}</span>
            <span>{formatOrderPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Details Section */}
      {order.payments && order.payments.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <CreditCard size={18} />
            {t('payment_details', 'Payment Details')}
          </h3>
          <div className={styles.paymentsList}>
            {order.payments.map((payment) => (
              <div key={payment.id} className={styles.paymentItem}>
                <div className={styles.paymentMethod}>
                  <CreditCard size={16} />
                  <span>{getPaymentMethodLabel(payment.paymentMethod) || 'N/A'}</span>
                </div>
                <div className={styles.paymentAmount}>{formatOrderPrice(payment.amount)}</div>
                <div className={styles.paymentStatus}>
                  <span className={getPaymentBadgeClasses(payment.status)}>
                    {payment.status ? t(`payment_status_${payment.status.toLowerCase()}`, payment.status) : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {order.notes && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <FileText size={18} />
            {t('notes', 'Notes')}
          </h3>
          <div className={styles.notesCard}>
            <p>{order.notes}</p>
          </div>
        </div>
      )}

      {/* Status History Section */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Clock size={18} />
            {t('action_history', 'Action History')}
          </h3>
          <div className={styles.timeline}>
            {order.statusHistory.map((history) => (
              <div key={history.id} className={styles.timelineItem}>
                <div className={styles.timelineDot}></div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineStatus}>
                    {history.status
                      ? t(`order_status_${history.status.toLowerCase()}`, history.status)
                      : t('status', 'Status')}
                  </div>
                  <div className={styles.timelineDate}>{formatOrderDate(history.changedAt)}</div>
                  {history.notes && <div className={styles.timelineNotes}>{translateTimelineNotes(history.notes)}</div>}
                  {history.changedBy && (
                    <div className={styles.timelineBy}>
                      {t('by', 'by')} {formatChangedBy(history.changedBy)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
