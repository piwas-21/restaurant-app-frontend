import FormField from '@/components/design-system/FormField';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './PaymentModal.module.css';

interface CashReceivedFieldsProps {
  readonly amount: string;
  readonly received: string;
  readonly disabled: boolean;
  readonly onReceivedChange: (value: string) => void;
  readonly onExact: () => void;
  readonly t: (key: string) => string;
}

/** Transient calculator only: received/change are never sent as captured money or implicit tip. */
export default function CashReceivedFields({
  amount,
  received,
  disabled,
  onReceivedChange,
  onExact,
  t,
}: CashReceivedFieldsProps) {
  const applied = Number.parseFloat(amount) || 0;
  const cashReceived = Number.parseFloat(received) || 0;
  const change = Math.max(0, cashReceived - applied);

  return (
    <div>
      <FormField label={t('cashier.cash_received')}>
        <input
          type="number"
          className={styles.input}
          min="0"
          step="0.01"
          value={received}
          onChange={(event) => onReceivedChange(event.target.value)}
          disabled={disabled}
        />
      </FormField>
      <button type="button" className={styles.maxButton} onClick={onExact} disabled={disabled || !amount}>
        {t('cashier.cash_exact')}
      </button>
      <output>
        {t('cashier.cash_change')}: <strong>{formatPlainCurrency(change)}</strong>
      </output>
    </div>
  );
}
