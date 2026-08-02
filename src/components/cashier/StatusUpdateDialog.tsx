'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { nextOrderStatuses, orderStatusLabel } from '@/lib/orderStatus';
import { X } from 'lucide-react';

interface StatusUpdateDialogProps {
  order: OrderDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newStatus: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for updating order status
 * Shows available next statuses based on current status
 */
export default function StatusUpdateDialog({
  order,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: StatusUpdateDialogProps) {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // The server's table, not this dialog's guess. Its own `switch` disagreed with
  // `IsValidStatusTransition` in SIX of the union's twelve states — offering transitions the server
  // rejects,
  // and stranding a PendingApproval or OutForDelivery order with nothing to pick at all.
  const availableStatuses = nextOrderStatuses(order?.status);

  const handleStatusSelect = useCallback((status: string) => {
    setSelectedStatus(status);
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedStatus) {
      setError(t('cashier.select_status') || 'Please select a status');
      return;
    }

    try {
      await onConfirm(selectedStatus);
      setSelectedStatus('');
      onClose();
    } catch (err) {
      setError((err as Error).message || t('cashier.status_update_failed') || 'Failed to update status');
    }
  }, [selectedStatus, onConfirm, onClose, t]);

  if (!isOpen || !order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('cashier.update_status') || 'Update Order Status'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('cashier.current_status') || 'Current Status'}</label>
            <div className="status-display">
              <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                {orderStatusLabel(order.status, t)}
              </span>
            </div>
          </div>

          {availableStatuses.length > 0 ? (
            <div className="form-group">
              <label className="form-label">{t('cashier.new_status') || 'New Status'}</label>
              <div className="status-options">
                {availableStatuses.map((status) => (
                  <button
                    key={status}
                    className={`status-option ${selectedStatus === status ? 'selected' : ''}`}
                    onClick={() => handleStatusSelect(status)}
                    disabled={isLoading}
                  >
                    <span className={`status-badge status-${status?.toLowerCase()}`}>
                      {orderStatusLabel(status, t)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="alert alert-info">
              {t('cashier.no_status_transitions') || 'No status transitions available for this order'}
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {t('common.cancel') || 'Cancel'}
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!selectedStatus || isLoading}>
            {isLoading ? t('common.loading') || 'Loading...' : t('common.confirm') || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
