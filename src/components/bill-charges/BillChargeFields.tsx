'use client';

import { MAX_BILL_CHARGE_AMOUNT, BILL_CHARGE_AMOUNT_STEP } from '@/lib/billChargeLimits';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import BillChargeConfigurationNotice from './BillChargeConfigurationNotice';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { BillChargeInput } from '@/types/billCharge';
import styles from './BillCharges.module.css';

export interface BillChargeFieldsProps {
  readonly orderType: string;
  readonly values: readonly BillChargeInput[];
  readonly onChange: (values: BillChargeInput[]) => void;
  readonly disabled?: boolean;
  readonly existingKeys?: readonly string[];
}

export default function BillChargeFields({
  orderType,
  values,
  onChange,
  disabled = false,
  existingKeys = [],
}: BillChargeFieldsProps) {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const role = auth?.user?.role;
  const reader = useBillChargeConfiguration();
  if (!reader.configuration) return <BillChargeConfigurationNotice reader={reader} />;
  const rules =
    reader.configuration?.rules.filter(
      (rule) =>
        rule.enabled &&
        rule.orderTypes.some((value) => value === orderType) &&
        (role?.toLowerCase() === 'admin' || rule.roles.some((r) => r.toLowerCase() === role?.toLowerCase())) &&
        !existingKeys.includes(rule.key),
    ) ?? [];
  const unavailable = values.filter((value) => !rules.some((rule) => rule.key === value.key));
  if (!rules.length && !values.length) return <BillChargeConfigurationNotice reader={reader} />;
  const change = (key: string, amount: number | null) =>
    onChange([...values.filter((value) => value.key !== key), ...(amount === null ? [] : [{ key, amount }])]);
  return (
    <fieldset className={styles.fields} disabled={disabled}>
      <legend>{t('billCharges.title')}</legend>
      <BillChargeConfigurationNotice reader={reader} />
      {unavailable.map((value) => (
        <div key={value.key}>
          <p>
            {value.key}: {t('billCharges.unavailable')}
          </p>
          <button type="button" disabled={disabled} onClick={() => change(value.key, null)}>
            {t('remove')}
          </button>
        </div>
      ))}
      {rules.map((rule) => {
        const value = values.find((input) => input.key === rule.key);
        return (
          <div className={styles.charge} key={rule.key}>
            <CheckboxField
              label={rule.label}
              checked={!!value}
              onChange={(checked) => change(rule.key, checked ? rule.defaultAmount : null)}
            />
            {value && (
              <FormField label={`${rule.label} (${reader.configuration?.currency ?? ''})`}>
                <input
                  type="number"
                  min="0"
                  max={MAX_BILL_CHARGE_AMOUNT}
                  step={BILL_CHARGE_AMOUNT_STEP}
                  inputMode="decimal"
                  value={value.amount}
                  readOnly={!rule.allowCustomAmount}
                  onChange={(event) => change(rule.key, Number(event.target.value))}
                />
              </FormField>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
