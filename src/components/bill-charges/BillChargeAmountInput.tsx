'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { MAX_BILL_CHARGE_AMOUNT } from '@/lib/billChargeLimits';
import { parseBillChargeAmount } from '@/lib/billChargeAmount';
import styles from './BillChargeControls.module.css';

interface Props {
  readonly label: string;
  readonly currency: string;
  readonly value: number;
  readonly onChange: (amount: number) => void;
  readonly onValidityChange?: (valid: boolean) => void;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly compact?: boolean;
  readonly percentage?: boolean;
}

export default function BillChargeAmountInput({
  label,
  currency,
  value,
  onChange,
  onValidityChange,
  disabled,
  readOnly,
  compact,
  percentage = false,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(value === 0 ? '' : String(value));
  const lastSent = useRef(value);
  const parsed = parseBillChargeAmount(text);
  const max = percentage ? 100 : MAX_BILL_CHARGE_AMOUNT;
  const valid = parsed !== null && parsed <= max;
  useEffect(() => {
    if (value !== lastSent.current) setText(value === 0 ? '' : String(value));
    lastSent.current = value;
  }, [value]);
  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);
  const error = valid ? undefined : t('billCharges.invalidAmount', { max });
  return (
    <FormField label={label} htmlFor={id} srOnlyLabel={compact} error={error} className={styles.amountField}>
      <span className={styles.amountBox}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={styles.amountInput}
          value={text}
          placeholder="0.00"
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-amount-error` : undefined}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const amount = parseBillChargeAmount(next);
            if (amount !== null && amount <= max) {
              lastSent.current = amount;
              onChange(amount);
            }
          }}
        />
        <span className={styles.currency} aria-hidden="true">
          {percentage ? '%' : currency}
        </span>
        {error && (
          <span id={`${id}-amount-error`} className="sr-only" aria-hidden="true">
            {error}
          </span>
        )}
      </span>
    </FormField>
  );
}
