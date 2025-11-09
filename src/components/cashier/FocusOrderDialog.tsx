'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { X, Star } from 'lucide-react';

interface FocusOrderDialogProps {
  order: OrderDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isFocus: boolean, priority?: number, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for marking/unmarking orders as focus (priority)
 */
export default function FocusOrderDialog({
  order,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: FocusOrderDialogProps) {
  const { t } = useTranslation();
  const [isFocus, setIsFocus] = useState<boolean>(order?.isFocusOrder || false);
  const [priority, setPriority] = useState<number>(order?.priority || 0);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm(isFocus, isFocus ? priority : undefined, reason || undefined);

      // Reset form
      setReason('');
      onClose();
    } catch (err) {
      setError((err as Error).message || t('cashier.focus_toggle_failed') || 'Failed to update focus status');
    }
  }, [isFocus, priority, reason, onConfirm, onClose, t]);

  if (!isOpen || !order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Star size={24} />
            <h2>{t('cashier.focus_order') || 'Focus Order'}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Focus Toggle */}
          <div className="form-group">
            <label className="form-label">{t('cashier.mark_as_focus') || 'Mark as Focus'}</label>
            <div className="toggle-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={isFocus}
                  onChange={(e) => {
                    setIsFocus(e.target.checked);
                    setError(null);
                  }}
                  disabled={isLoading}
                />
                <span>
                  {isFocus
                    ? t('cashier.focus_marked') || 'This order is marked as focus'
                    : t('cashier.mark_as_focus_desc') || 'Mark this order as priority'}
                </span>
              </label>
            </div>
          </div>

          {/* Priority Level (if focus) */}
          {isFocus && (
            <div className="form-group">
              <label className="form-label">{t('cashier.priority_level') || 'Priority Level'}</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                disabled={isLoading}
              >
                <option value={0}>{t('cashier.priority_normal') || 'Normal'}</option>
                <option value={1}>{t('cashier.priority_high') || 'High'}</option>
                <option value={2}>{t('cashier.priority_urgent') || 'Urgent'}</option>
              </select>
            </div>
          )}

          {/* Reason */}
          <div className="form-group">
            <label className="form-label">
              {t('cashier.focus_reason') || 'Reason'} {isFocus ? '*' : '(optional)'}
            </label>
            <textarea
              className="form-textarea"
              placeholder={
                isFocus
                  ? t('cashier.focus_reason_placeholder') || 'Why is this order marked as focus?'
                  : t('cashier.remove_focus_reason_placeholder') || 'Reason for removing focus (optional)'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Info */}
          <div className="alert alert-info">
            {isFocus
              ? t('cashier.focus_info') ||
                'Marking an order as focus will highlight it for kitchen staff. Use for VIP customers, special requests, or urgent orders.'
              : t('cashier.remove_focus_info') || 'This will remove the focus flag from the order.'}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {t('common.cancel') || 'Cancel'}
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? t('common.loading') || 'Loading...' : t('common.confirm') || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
