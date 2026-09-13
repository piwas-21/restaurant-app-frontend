import FormField from '@/components/design-system/FormField';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import styles from './PaymentModal.module.css';

interface CashReceivedFieldsProps {
  readonly amount: string;
  readonly received: string;
  readonly currency?: string | null;
  readonly suggestions?: readonly number[];
  readonly disabled: boolean;
  readonly onReceivedChange: (value: string) => void;
  readonly onExact: () => void;
  readonly onSuggestion?: (value: number) => void;
  readonly t: (key: string) => string;
}

/** Transient calculator only: received/change are never sent as captured money or implicit tip. */
export default function CashReceivedFields({
  amount,
  received,
  currency,
  suggestions = [],
  disabled,
  onReceivedChange,
  onExact,
  onSuggestion,
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
      <div className={styles.cashSuggestionGroup}>
        {suggestions.length > 1 && (
          <span className={styles.cashSuggestionLabel}>{t('cashier.collection.cash_suggestions')}</span>
        )}
        <div className={styles.cashSuggestions}>
          <button type="button" className={styles.maxButton} onClick={onExact} disabled={disabled || !amount}>
            {t('cashier.cash_exact')}
          </button>
          {suggestions.slice(1).map((suggestion) => (
            <button
              type="button"
              className={styles.maxButton}
              key={suggestion}
              onClick={() => onSuggestion?.(suggestion)}
              disabled={disabled || !onSuggestion}
            >
              {formatOrderCurrency(suggestion, { currency })}
            </button>
          ))}
        </div>
      </div>
      <output aria-live="polite">
        {t('cashier.cash_change')}: <strong>{formatOrderCurrency(change, { currency })}</strong>
      </output>
    </div>
  );
}
