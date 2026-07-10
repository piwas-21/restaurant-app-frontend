'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto, OrderType } from '@/types/order';
import { X, Clock, CheckCircle, XCircle, Package } from 'lucide-react';
import styles from './QuickConfirmModal.module.css';

interface QuickConfirmModalProps {
  order: OrderDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderNumber: string, preparationMinutes: number) => Promise<void>;
  onCancel: (orderNumber: string) => Promise<void>;
}

export default function QuickConfirmModal({ order, isOpen, onClose, onConfirm, onCancel }: QuickConfirmModalProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !order) return null;

  const handleConfirm = async (minutes: number) => {
    setIsProcessing(true);
    try {
      await onConfirm(order.orderNumber, minutes);
      onClose();
    } catch (error) {
      console.error('Failed to confirm order:', error);
      // Error handling is done in parent component
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = window.confirm(
      t('cashier.confirm_cancel_order', 'Are you sure you want to cancel this order? The customer will be notified.'),
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await onCancel(order.orderNumber);
      onClose();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      // Error handling is done in parent component
    } finally {
      setIsProcessing(false);
    }
  };

  const orderTypeEmoji = order.type === OrderType.Takeaway ? '🛍️' : '🚚';
  const orderTypeLabel = order.type === OrderType.Takeaway ? 'Takeaway' : 'Delivery';

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.orderTypeIcon}>{orderTypeEmoji}</div>
            <div>
              <h2 className={styles.title}>{t('new_order_received', 'New Order Received')}</h2>
              <p className={styles.subtitle}>{t('quick_confirm_subtitle', 'Confirm or set preparation time')}</p>
            </div>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isProcessing}
            aria-label={t('common.close', 'Close')}
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Order Summary */}
          <div className={styles.orderSummary}>
            <div className={styles.summaryRow}>
              <span className={styles.label}>{t('order_number', 'Order Number')}</span>
              <span className={styles.value}>{order.orderNumber}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.label}>{t('type', 'Type')}</span>
              <span className={styles.valueBadge}>
                {orderTypeEmoji} {orderTypeLabel}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.label}>{t('customer', 'Customer')}</span>
              <span className={styles.value}>{order.customerName || t('guest.label', 'Guest')}</span>
            </div>
            {order.customerPhone && (
              <div className={styles.summaryRow}>
                <span className={styles.label}>{t('customer.phone', 'Phone')}</span>
                <span className={styles.value}>{order.customerPhone}</span>
              </div>
            )}
            <div className={styles.summaryRow}>
              <span className={styles.label}>{t('total', 'Total')}</span>
              <span className={styles.valueTotal}>{formatPlainCurrency(order.total)}</span>
            </div>
          </div>

          {/* Action Required Alert */}
          <div className={styles.alertBox}>
            <Package size={20} />
            <span>{t('action_required', 'Please confirm or cancel this order')}</span>
          </div>

          {/* Confirm Now Button */}
          <button className={styles.confirmNowButton} onClick={() => handleConfirm(0)} disabled={isProcessing}>
            <CheckCircle size={20} />
            {t('confirm_now', 'Confirm Now')}
          </button>

          {/* Or Divider */}
          <div className={styles.divider}>
            <span>{t('or', 'or')}</span>
          </div>

          {/* Preparation Time Label */}
          <p className={styles.prepTimeLabel}>
            <Clock size={16} />
            {t('confirm_with_prep_time', 'Confirm with preparation time:')}
          </p>

          {/* Time Buttons */}
          <div className={styles.timeButtons}>
            <button className={styles.timeButton} onClick={() => handleConfirm(15)} disabled={isProcessing}>
              15 min
            </button>
            <button className={styles.timeButton} onClick={() => handleConfirm(30)} disabled={isProcessing}>
              30 min
            </button>
            <button className={styles.timeButton} onClick={() => handleConfirm(45)} disabled={isProcessing}>
              45 min
            </button>
          </div>

          {/* Cancel Button */}
          <button className={styles.cancelButton} onClick={handleCancel} disabled={isProcessing}>
            <XCircle size={20} />
            {t('cancel_order', 'Cancel Order')}
          </button>

          {/* Info Text */}
          <p className={styles.infoText}>
            {t('customer_notification_info', 'The customer will be notified automatically after you take action.')}
          </p>
        </div>
      </div>
    </>
  );
}
