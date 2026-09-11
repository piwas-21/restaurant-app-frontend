import FormField from '@/components/design-system/FormField';
import { PaymentMethod } from '@/types/order';
import styles from './PaymentModal.module.css';

interface PaymentMethodFieldProps {
  readonly method: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly t: (key: string) => string;
}

export default function PaymentMethodField({ method, disabled, onChange, t }: PaymentMethodFieldProps) {
  return (
    <>
      <FormField label={`${t('cashier.payment_method')} *`}>
        <select
          className={styles.select}
          value={method}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value={PaymentMethod.Cash}>{t('cashier.table_bill.method_cash')}</option>
          <option value={PaymentMethod.CreditCard}>{t('cashier.table_bill.method_credit_card')}</option>
          <option value={PaymentMethod.DebitCard}>{t('cashier.table_bill.method_debit_card')}</option>
        </select>
      </FormField>
      {method !== PaymentMethod.Cash && (
        <p role="note" className={styles.cardNotice}>
          {t('cashier.standalone_card_instruction')}
        </p>
      )}
    </>
  );
}
