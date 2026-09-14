import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { REFUND_REASON_MIN_LENGTH } from '@/schemas/refund.schema';
import type { OrderPaymentDto } from '@/types/order';
import RefundPaymentPicker from './RefundPaymentPicker';
import styles from './RefundModal.module.css';

type RefundType = 'full' | 'partial';

export interface RefundModalFieldErrors {
  paymentId?: string;
  refundAmount?: string;
  reason?: string;
}

interface RefundModalFieldsProps {
  refundablePayments: OrderPaymentDto[];
  gatewayHeldPayments: OrderPaymentDto[];
  selectedPaymentId: string;
  refundType: RefundType;
  refundAmount: string;
  reason: string;
  maxRefundAmount: number;
  errors: RefundModalFieldErrors;
  isLoading: boolean;
  onPaymentSelect: (paymentId: string) => void;
  onRefundTypeChange: (type: RefundType) => void;
  onAmountChange: (value: string) => void;
  onSetMaxAmount: () => void;
  onReasonChange: (value: string) => void;
}

export default function RefundModalFields({
  refundablePayments,
  gatewayHeldPayments,
  selectedPaymentId,
  refundType,
  refundAmount,
  reason,
  maxRefundAmount,
  errors,
  isLoading,
  onPaymentSelect,
  onRefundTypeChange,
  onAmountChange,
  onSetMaxAmount,
  onReasonChange,
}: Readonly<RefundModalFieldsProps>) {
  const { t } = useTranslation();

  return (
    <>
      <RefundPaymentPicker
        refundable={refundablePayments}
        gatewayHeld={gatewayHeldPayments}
        selectedPaymentId={selectedPaymentId}
        onSelect={onPaymentSelect}
        isLoading={isLoading}
        error={errors.paymentId}
      />

      {selectedPaymentId && (
        <>
          <fieldset className={styles.typeField} disabled={isLoading}>
            <legend className={styles.typeLegend}>{t('cashier.refund_type')} *</legend>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="refundType"
                  value="full"
                  checked={refundType === 'full'}
                  onChange={() => onRefundTypeChange('full')}
                />
                <span>
                  {t('cashier.full_refund')} ({maxRefundAmount.toFixed(2)})
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="refundType"
                  value="partial"
                  checked={refundType === 'partial'}
                  onChange={() => onRefundTypeChange('partial')}
                />
                <span>{t('cashier.partial_refund')}</span>
              </label>
            </div>
          </fieldset>

          {refundType === 'partial' && (
            <FormField label={`${t('cashier.refund_amount')} *`} error={errors.refundAmount} htmlFor="refund-amount">
              <div className={styles.amountControls}>
                <input
                  id="refund-amount"
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(event) => onAmountChange(event.target.value)}
                  disabled={isLoading}
                  min="0"
                  step="0.01"
                  max={maxRefundAmount}
                />
                <button type="button" onClick={onSetMaxAmount} disabled={isLoading}>
                  {t('cashier.max')}
                </button>
              </div>
            </FormField>
          )}

          {refundType === 'full' && errors.refundAmount && <p className={styles.submitError}>{errors.refundAmount}</p>}

          <FormField label={`${t('cashier.refund_reason')} *`} error={errors.reason} htmlFor="refund-reason">
            <textarea
              id="refund-reason"
              className="form-textarea"
              placeholder={t('cashier.refund_reason_placeholder')}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              disabled={isLoading}
              required
              minLength={REFUND_REASON_MIN_LENGTH}
              rows={3}
            />
          </FormField>
        </>
      )}
    </>
  );
}
