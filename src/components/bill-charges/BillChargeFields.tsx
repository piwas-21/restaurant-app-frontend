'use client';

import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBillChargeFields } from '@/hooks/useBillChargeFields';
import BillChargeConfigurationNotice from './BillChargeConfigurationNotice';
import BillChargeAmountInput from './BillChargeAmountInput';
import BillChargeIcon from './BillChargeIcon';
import type { BillChargeInput } from '@/types/billCharge';
import controls from './BillChargeControls.module.css';
import styles from './BillCharges.module.css';

export interface BillChargeFieldsProps {
  readonly orderType: string;
  readonly values: readonly BillChargeInput[];
  readonly onChange: (values: BillChargeInput[]) => void;
  readonly disabled?: boolean;
  readonly existingKeys?: readonly string[];
  readonly onValidityChange?: (valid: boolean) => void;
}

export default function BillChargeFields({
  orderType,
  values,
  onChange,
  disabled = false,
  existingKeys = [],
  onValidityChange,
}: BillChargeFieldsProps) {
  const { t } = useTranslation();
  const { reader, rules, unavailable, setValid } = useBillChargeFields(
    orderType,
    values,
    existingKeys,
    onValidityChange,
  );
  if (!reader.configuration) return <BillChargeConfigurationNotice reader={reader} />;
  if (!rules.length && !values.length) return <BillChargeConfigurationNotice reader={reader} />;
  const change = (key: string, amount: number | null) => {
    if (amount === null) setValid(key, true);
    onChange([...values.filter((value) => value.key !== key), ...(amount === null ? [] : [{ key, amount }])]);
  };
  return (
    <section className={styles.fields} aria-label={t('billCharges.title')}>
      <div className={styles.heading}>
        <strong>{t('billCharges.title')}</strong>
        <small>{t('billCharges.optional')}</small>
      </div>
      <BillChargeConfigurationNotice reader={reader} />
      {unavailable.map((value) => (
        <div className={styles.unavailable} key={value.key}>
          <p>{t('billCharges.unavailable')}</p>
          <button type="button" className={controls.chip} disabled={disabled} onClick={() => change(value.key, null)}>
            {t('remove')}
          </button>
        </div>
      ))}
      <div className={controls.chips}>
        {rules
          .filter((rule) => !values.some((value) => value.key === rule.key))
          .map((rule) => (
            <button
              type="button"
              className={controls.chip}
              key={rule.key}
              disabled={disabled}
              onClick={() => change(rule.key, rule.defaultAmount)}
            >
              <Plus size={16} aria-hidden="true" />
              <span dir="auto">{rule.label}</span>
            </button>
          ))}
      </div>
      {rules
        .filter((rule) => values.some((value) => value.key === rule.key))
        .map((rule) => {
          const value = values.find((input) => input.key === rule.key)!;
          return (
            <div className={styles.charge} key={rule.key}>
              <span className={styles.icon}>
                <BillChargeIcon chargeKey={rule.key} />
              </span>
              <span className={styles.chargeName} dir="auto">
                {rule.label}
              </span>
              <BillChargeAmountInput
                label={`${rule.label} (${reader.configuration?.currency ?? ''})`}
                currency={reader.configuration?.currency ?? ''}
                value={value.amount}
                compact
                disabled={disabled}
                readOnly={!rule.allowCustomAmount}
                onChange={(amount) => change(rule.key, amount)}
                onValidityChange={(valid) => setValid(rule.key, valid)}
              />
              <button
                type="button"
                className={controls.iconButton}
                disabled={disabled}
                aria-label={t('billCharges.removeNamed', { label: rule.label })}
                onClick={() => change(rule.key, null)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          );
        })}
    </section>
  );
}
