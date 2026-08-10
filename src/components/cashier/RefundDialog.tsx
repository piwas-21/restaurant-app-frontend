'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { X } from 'lucide-react';
import { isHeldByGateway } from '@/utils/tenderCustody';
import RefundPaymentPicker from './RefundPaymentPicker';

interface RefundDialogProps {
  order: OrderDto | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentId: string, amount?: number) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for refunding a payment
 * Allows full or partial refund of completed payments
 */
export default function RefundDialog({ order, isOpen, onClose, onConfirm, isLoading = false }: RefundDialogProps) {
  const { t } = useTranslation();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // `'Completed'`, not `'Paid'` — a payment record is created Completed and only ever moves to
  // Refunded, so the old comparison matched nothing and this list was ALWAYS empty: a cashier could
  // never select a payment to refund. `PaymentRecordStatus` now makes that comparison uncompilable.
  //
  // `Completed` alone mirrors the server's own guard (`RefundPaymentCommand` refuses anything that
  // is not Completed), so an already partially-refunded payment is correctly absent: the backend
  // cannot take a second refund against it. Widening this list would only move the refusal to a
  // place the cashier finds out about later.
  //
  // The custody split mirrors the server's OTHER guard, added in S11: a tender captured by a
  // gateway is refunded in that gateway's dashboard, never here. Both halves are kept, not just
  // the refundable one — a payment that vanishes with no explanation is how a cashier concludes
  // the system lost it.
  const completedPayments = order?.payments?.filter((p) => p.status === 'Completed') || [];
  const gatewayHeldPayments = completedPayments.filter(isHeldByGateway);
  const refundablePayments = completedPayments.filter((p) => !isHeldByGateway(p));

  const selectedPayment = refundablePayments.find((p) => p.id === selectedPaymentId);
  const maxRefundAmount = selectedPayment?.amount || 0;

  const handlePaymentSelect = useCallback((paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setRefundAmount('');
    setRefundType('full');
    setError(null);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) || value === '') {
      setRefundAmount(value);
      setError(null);
    }
  }, []);

  const handleSetMaxAmount = useCallback(() => {
    setRefundAmount(maxRefundAmount.toFixed(2));
    setError(null);
  }, [maxRefundAmount]);

  const handleRefundTypeChange = useCallback(
    (type: 'full' | 'partial') => {
      setRefundType(type);
      if (type === 'full') {
        setRefundAmount(maxRefundAmount.toFixed(2));
      } else {
        setRefundAmount('');
      }
      setError(null);
    },
    [maxRefundAmount],
  );

  const handleConfirm = useCallback(async () => {
    if (!selectedPaymentId) {
      setError(t('cashier.select_payment_to_refund') || 'Please select a payment to refund');
      return;
    }

    let amount: number | undefined;
    if (refundType === 'partial') {
      if (!refundAmount || parseFloat(refundAmount) <= 0) {
        setError(t('cashier.refund_amount_required'));
        return;
      }

      amount = parseFloat(refundAmount);
      if (amount > maxRefundAmount) {
        // `|| '…'` removed from this call and the one above (#417): `t()` returns the KEY when a key
        // is missing, and a key is a non-empty string, so the right-hand side could never run — the
        // cashier saw `cashier.refund_exceeds_payment` on screen, not the English sentence that
        // looks like a fallback. Both keys now exist in all ten locales, and the amount the dead
        // branch carried is preserved as an interpolation rather than lost.
        //
        // The other 14 `t(…) || '…'` in this file are deliberately untouched: their keys DO resolve,
        // so the dead branch never mattered. Only these two rendered a key to a cashier.
        setError(t('cashier.refund_exceeds_payment', { max: maxRefundAmount.toFixed(2) }));
        return;
      }
    }

    try {
      await onConfirm(selectedPaymentId, amount);

      // Reset form
      setSelectedPaymentId('');
      setRefundAmount('');
      setRefundType('full');
      setReason('');
      onClose();
    } catch (err) {
      setError((err as Error).message || t('cashier.refund_failed') || 'Failed to process refund');
    }
  }, [selectedPaymentId, refundType, refundAmount, maxRefundAmount, onConfirm, onClose, t]);

  if (!isOpen || !order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('cashier.refund_payment') || 'Refund Payment'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <RefundPaymentPicker
            refundable={refundablePayments}
            gatewayHeld={gatewayHeldPayments}
            selectedPaymentId={selectedPaymentId}
            onSelect={handlePaymentSelect}
            isLoading={isLoading}
          />

          {refundablePayments.length > 0 && (
            <>
              {selectedPaymentId && (
                <>
                  {/* Refund Type */}
                  <div className="form-group">
                    <label className="form-label">{t('cashier.refund_type') || 'Refund Type'} *</label>
                    <div className="radio-group">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="refundType"
                          value="full"
                          checked={refundType === 'full'}
                          onChange={() => handleRefundTypeChange('full')}
                          disabled={isLoading}
                        />
                        <span>
                          {t('cashier.full_refund') || 'Full Refund'} ({maxRefundAmount.toFixed(2)})
                        </span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="refundType"
                          value="partial"
                          checked={refundType === 'partial'}
                          onChange={() => handleRefundTypeChange('partial')}
                          disabled={isLoading}
                        />
                        <span>{t('cashier.partial_refund') || 'Partial Refund'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Refund Amount (for partial refunds) */}
                  {refundType === 'partial' && (
                    <div className="form-group">
                      <label className="form-label">{t('cashier.refund_amount') || 'Refund Amount'} *</label>
                      <div className="amount-input-group">
                        <input
                          type="number"
                          className="form-input"
                          placeholder="0.00"
                          value={refundAmount}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          disabled={isLoading}
                          min="0"
                          step="0.01"
                          max={maxRefundAmount}
                        />
                        <button className="btn btn-secondary btn-sm" onClick={handleSetMaxAmount} disabled={isLoading}>
                          {t('cashier.max') || 'Max'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reason for Refund */}
                  <div className="form-group">
                    <label className="form-label">{t('cashier.refund_reason') || 'Reason for Refund'} (optional)</label>
                    <textarea
                      className="form-textarea"
                      placeholder={t('cashier.refund_reason_placeholder') || 'Enter reason for refund'}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={isLoading}
                      rows={3}
                    />
                  </div>
                </>
              )}

              {error && <div className="alert alert-error">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            {t('common.cancel') || 'Cancel'}
          </button>
          {refundablePayments.length > 0 && (
            <button className="btn btn-danger" onClick={handleConfirm} disabled={!selectedPaymentId || isLoading}>
              {isLoading ? t('common.loading') || 'Loading...' : t('cashier.process_refund') || 'Process Refund'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
