import { Banknote, CreditCard, WalletCards } from 'lucide-react';
import { PaymentMethod } from '@/types/order';
import styles from './PaymentMethodField.module.css';

interface PaymentMethodFieldProps {
  readonly method: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly t: (key: string) => string;
}

export default function PaymentMethodField({ method, disabled, onChange, t }: PaymentMethodFieldProps) {
  const options = [
    [PaymentMethod.Cash, 'cashier.table_bill.method_cash', Banknote],
    [PaymentMethod.CreditCard, 'payment_card_at_restaurant', CreditCard],
    [PaymentMethod.DebitCard, 'cashier.table_bill.method_debit_card', WalletCards],
  ] as const;
  return (
    <>
      <fieldset className={styles.group} disabled={disabled}>
        <legend>{t('cashier.payment_method')}</legend>
        <div className={styles.methods}>
          {options.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={method === value}
              className={styles.method}
              disabled={disabled}
              onClick={() => onChange(value)}
            >
              <Icon size={21} aria-hidden="true" />
              {t(label)}
            </button>
          ))}
        </div>
      </fieldset>
      {method !== PaymentMethod.Cash && (
        <p role="note" className={styles.note}>
          {t('cashier.standalone_card_instruction')}
        </p>
      )}
    </>
  );
}
