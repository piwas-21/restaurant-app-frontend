'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { X, AlertCircle } from 'lucide-react';

interface CancelOrderDialogProps {
  order: OrderDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for cancelling an order
 * Shows warning and requires confirmation + reason
 */
export default function CancelOrderDialog({
  order,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CancelOrderDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!confirmed) {
      setError(t('cashier.confirm_cancel_acknowledgment') || 'Please confirm that you want to cancel this order');
      return;
    }

    try {
      await onConfirm(reason || undefined);

      // Reset form
      setReason('');
      setConfirmed(false);
      onClose();
    } catch (err) {
      setError((err as Error).message || t('cashier.cancel_failed') || 'Failed to cancel order');
    }
  }, [confirmed, reason, onConfirm, onClose, t]);

  if (!isOpen || !order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-danger" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header-danger">
          <div className="modal-title-wrapper">
            <AlertCircle size={24} />
            <h2>{t('cashier.cancel_order') || 'Cancel Order'}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Warning */}
          <div className="alert alert-warning">
            <strong>{t('cashier.warning') || 'Warning'}</strong>
            <p>{t('cashier.cancel_order_warning') || 'This action will cancel the order and cannot be undone.'}</p>
          </div>

          {/* Order Info */}
          <div className="form-group">
            <label className="form-label">{t('cashier.order_to_cancel') || 'Order to Cancel'}</label>
            <div className="cancel-order-info">
              <div className="info-row">
                <span className="info-label">{t('cashier.order_number') || 'Order #'}</span>
                <span className="info-value">{order.orderNumber}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('cashier.customer_name') || 'Customer'}</span>
                <span className="info-value">{order.customerName || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('cashier.total') || 'Total'}</span>
                <span className="info-value">{(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Reason for Cancellation */}
          <div className="form-group">
            <label className="form-label">
              {t('cashier.cancellation_reason') || 'Reason for Cancellation'} (optional)
            </label>
            <textarea
              className="form-textarea"
              placeholder={t('cashier.cancellation_reason_placeholder') || 'Enter reason for cancelling this order'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  setError(null);
                }}
                disabled={isLoading}
              />
              <span>
                {t('cashier.confirm_cancel_acknowledge') || 'I understand that cancelling this order cannot be undone'}
              </span>
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {t('common.keep_order') || 'Keep Order'}
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={!confirmed || isLoading}>
            {isLoading ? t('common.loading') || 'Loading...' : t('cashier.yes_cancel_order') || 'Yes, Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
