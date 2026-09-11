import FormField from '@/components/design-system/FormField';
import styles from './PaymentModal.module.css';

interface PaymentReferenceFieldsProps {
  readonly transactionId: string;
  readonly notes: string;
  readonly disabled: boolean;
  readonly onTransactionIdChange: (value: string) => void;
  readonly onNotesChange: (value: string) => void;
  readonly t: (key: string) => string;
}

export default function PaymentReferenceFields({
  transactionId,
  notes,
  disabled,
  onTransactionIdChange,
  onNotesChange,
  t,
}: PaymentReferenceFieldsProps) {
  return (
    <>
      <FormField label={t('cashier.transaction_id')}>
        <input
          type="text"
          className={styles.input}
          placeholder={t('cashier.transaction_id_placeholder')}
          value={transactionId}
          onChange={(event) => onTransactionIdChange(event.target.value)}
          disabled={disabled}
        />
      </FormField>
      <FormField label={t('cashier.notes')}>
        <textarea
          className={styles.textarea}
          placeholder={t('cashier.payment_notes_placeholder')}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          disabled={disabled}
          rows={3}
        />
      </FormField>
    </>
  );
}
