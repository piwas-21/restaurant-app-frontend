import FormField from '@/components/design-system/FormField';
import styles from './PaymentModal.module.css';

interface PaymentAmountFieldProps {
  readonly amount: string;
  readonly remainingBalance: number;
  readonly disabled: boolean;
  readonly error: string | null;
  readonly onAmountChange: (value: string) => void;
  readonly onSetMaxAmount: () => void;
  readonly t: (key: string) => string;
}

/** Amount entry and the one-click exact-balance action. */
export default function PaymentAmountField({
  amount,
  remainingBalance,
  disabled,
  error,
  onAmountChange,
  onSetMaxAmount,
  t,
}: PaymentAmountFieldProps) {
  return (
    <>
      <FormField label={`${t('cashier.payment_amount')} *`} error={error ?? undefined}>
        <input
          type="number"
          className={styles.input}
          placeholder="0.00"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          disabled={disabled}
          min="0"
          step="0.01"
          max={remainingBalance}
        />
      </FormField>
      <button
        type="button"
        className={styles.maxButton}
        onClick={onSetMaxAmount}
        disabled={disabled}
        title={t('cashier.use_remaining')}
      >
        {t('cashier.max')}
      </button>
    </>
  );
}
