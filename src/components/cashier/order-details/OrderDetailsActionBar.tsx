'use client';

import { useTranslation } from 'react-i18next';
import { CreditCard, XCircle, Zap, RefreshCw, ChevronDown } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { getOrderStatusColor } from '@/utils/orderStatusColor';
import styles from '../OrderDetails.module.css';

interface OrderDetailsActionBarProps {
  order: OrderDto;
  onQuickConfirm?: (orderId: string) => void;
  onAddPayment: () => void;
  onRefund: () => void;
  onCancel: () => void;
  onToggleFocus: () => void;
  nextStatuses: string[];
  isUpdating: boolean;
  isStatusMenuOpen: boolean;
  setIsStatusMenuOpen: (open: boolean) => void;
  onStatusSelect: (status: string) => void;
}

/**
 * The sticky action bar of the cashier OrderDetails (quick-confirm, status update, payment, refund,
 * cancel, focus). Extracted verbatim from OrderDetails (Sprint 4/6 god-file decomposition).
 */
export default function OrderDetailsActionBar({
  order,
  onQuickConfirm,
  onAddPayment,
  onRefund,
  onCancel,
  onToggleFocus,
  nextStatuses,
  isUpdating,
  isStatusMenuOpen,
  setIsStatusMenuOpen,
  onStatusSelect,
}: OrderDetailsActionBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.stickyActionBar}>
      <div className={styles.actionBarGrid}>
        {/* Quick Confirm for Takeaway/Delivery Pending Orders */}
        {onQuickConfirm && order.status === 'Pending' && (order.type === 'Takeaway' || order.type === 'Delivery') && (
          <button
            className={`${styles.actionButton} ${styles.actionButtonSuccess}`}
            onClick={() => onQuickConfirm(order.id)}
          >
            <Zap size={18} />
            {t('cashier.quick_confirm', 'Quick Confirm')}
          </button>
        )}

        {/* Status Update */}
        {nextStatuses.length > 0 && order.status !== 'Completed' && order.status !== 'Cancelled' && (
          <div className={styles.customDropdownContainer}>
            <button
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
              onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
              disabled={isUpdating}
            >
              <RefreshCw size={18} className={isUpdating ? styles.spin : ''} />
              {t('cashier.update_status', 'Update Status')}
              <ChevronDown size={16} className={`${styles.chevron} ${isStatusMenuOpen ? styles.chevronRotate : ''}`} />
            </button>

            {isStatusMenuOpen && (
              <>
                <div className={styles.dropdownOverlay} onClick={() => setIsStatusMenuOpen(false)} />
                <div className={styles.statusDropdownMenu}>
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      className={styles.statusDropdownItem}
                      onClick={() => onStatusSelect(status)}
                      disabled={isUpdating}
                    >
                      <span
                        className={styles.statusIndicator}
                        style={{ backgroundColor: getOrderStatusColor(status) }}
                      />
                      {t(`order_status_${status.toLowerCase()}`, status)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Add Payment - hide for completed/cancelled */}
        {order.status !== 'Completed' && order.status !== 'Cancelled' && (
          <button className={`${styles.actionButton} ${styles.actionButtonSuccess}`} onClick={onAddPayment}>
            <CreditCard size={18} />
            {t('cashier.add_payment', 'Payment')}
          </button>
        )}

        {order.totalPaid > 0 && (
          <button className={`${styles.actionButton} ${styles.actionButtonWarning}`} onClick={onRefund}>
            <RefreshCw size={18} />
            {t('cashier.refund', 'Refund')}
          </button>
        )}

        {order.status !== 'Completed' && order.status !== 'Cancelled' && (
          <button className={`${styles.actionButton} ${styles.actionButtonDanger}`} onClick={onCancel}>
            <XCircle size={18} />
            {t('cancel', 'Cancel')}
          </button>
        )}

        <button
          className={`${styles.actionButton} ${order.isFocusOrder ? styles.actionButtonSecondary : styles.actionButtonInfo}`}
          onClick={onToggleFocus}
        >
          {order.isFocusOrder ? '⭐' : '☆'}{' '}
          {order.isFocusOrder ? t('remove_focus', 'Unfocus') : t('cashier.mark_as_focus', 'Focus')}
        </button>
      </div>
    </div>
  );
}
