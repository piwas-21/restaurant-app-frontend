import FormField from '@/components/design-system/FormField';
import { useTranslation } from 'react-i18next';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { formatOrderCurrency, orderCurrency } from '@/lib/cashierMoney';
import styles from './PaymentModal.module.css';

interface CashReceivedFieldsProps {
  readonly amount: string;
  readonly received: string;
  readonly currency?: string | null;
  readonly suggestions?: readonly number[];
  readonly disabled: boolean;
  readonly error?: string;

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
  error,
  onReceivedChange,
  onExact,
  onSuggestion,
  t,
}: CashReceivedFieldsProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const currencyCode = orderCurrency({ currency });
  const amountMinor = parseCurrencyAmountMinor(amount, currencyCode, locale) ?? 0;
  const receivedMinor = parseCurrencyAmountMinor(received, currencyCode, locale) ?? 0;
  const change = Math.max(0, receivedMinor - amountMinor) / 100;
  // Same resolution as the balance card beside it: the order's currency, else the tenant
  // default. The old strict-null branch alone rendered "Currency unavailable" for the change
  // while every other amount on the page showed tenant money (pilot feedback).
  const formatCash = (value: number) => formatOrderCurrency(value, { currency });

  return (
    <div>
      <FormField label={t('cashier.cash_received')} error={error}>
        <input
          type="text"
          inputMode="decimal"
          className={styles.input}
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
              {formatCash(suggestion)}
            </button>
          ))}
        </div>
      </div>
      <output aria-live="polite">
        {t('cashier.cash_change')}: <strong>{formatCash(change)}</strong>
      </output>
    </div>
  );
}
