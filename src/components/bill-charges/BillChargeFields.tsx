'use client';

import StaffButton from '@/components/design-system/StaffButton';
import { useEffect } from 'react';
import { billChargeDraftMode } from '@/lib/billChargePreview';
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
  readonly hasCapturedPayment?: boolean;
  readonly hasFrozenTax?: boolean;
  readonly existingKeys?: readonly string[];
  readonly onValidityChange?: (valid: boolean) => void;
}

export default function BillChargeFields({
  orderType,
  values,
  onChange,
  disabled = false,
  hasCapturedPayment = false,
  hasFrozenTax = false,
  existingKeys = [],
  onValidityChange,
}: BillChargeFieldsProps) {
  const { t } = useTranslation();
  const { reader, rules, unavailable, setValid, valid } = useBillChargeFields(orderType, values, existingKeys);
  const blockedReason = (rule: import('@/types/billCharge').BillChargeRule) => {
    if (hasFrozenTax && (rule.effect === 'Reduce' || rule.calculation === 'Percentage'))
      return t('billCharges.taxReconciliation');
    if (hasCapturedPayment && rule.effect === 'Reduce') return t('billCharges.beforePayment');
    return undefined;
  };
  const blocked = values.some((value) => {
    const rule = rules.find((candidate) => candidate.key === value.key);
    return rule && Boolean(blockedReason(rule));
  });
  useEffect(() => onValidityChange?.(valid && !blocked), [onValidityChange, valid, blocked]);
  if (!reader.configuration) return <BillChargeConfigurationNotice reader={reader} />;
  if (!rules.length && !values.length) return <BillChargeConfigurationNotice reader={reader} />;
  const change = (key: string, amount: number | null) => {
    if (amount === null) setValid(key, true);
    onChange([
      ...values.filter((value) => value.key !== key),
      ...(amount === null ? [] : [{ key, amount, ...billChargeDraftMode(rules.find((rule) => rule.key === key)!) }]),
    ]);
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
      {blocked && <p role="alert">{t(hasFrozenTax ? 'billCharges.taxReconciliation' : 'billCharges.beforePayment')}</p>}
      <div className={controls.chips}>
        {rules
          .filter((rule) => !values.some((value) => value.key === rule.key))
          .map((rule) => (
            <StaffButton
              className={controls.chip}
              key={rule.key}
              disabledReason={blockedReason(rule)}
              disabled={disabled}
              onClick={() => change(rule.key, rule.defaultAmount)}
            >
              <Plus size={16} aria-hidden="true" />
              <span dir="auto">{rule.label}</span>
            </StaffButton>
          ))}
      </div>
      {rules
        .filter((rule) => values.some((value) => value.key === rule.key && !unavailable.includes(value)))
        .map((rule) => {
          const value = values.find((input) => input.key === rule.key)!;
          return (
            <div className={styles.charge} key={rule.key}>
              <span className={styles.icon}>
                <BillChargeIcon chargeKey={rule.key} />
              </span>
              <span className={styles.chargeName} dir="auto">
                {rule.label}
                {rule.effect === 'Reduce' && <small>{t('billCharges.reduce')}</small>}
              </span>
              <BillChargeAmountInput
                label={`${rule.label} (${rule.calculation === 'Percentage' ? '%' : (reader.configuration?.currency ?? '')})`}
                currency={reader.configuration?.currency ?? ''}
                value={value.amount}
                compact
                percentage={rule.calculation === 'Percentage'}
                disabled={disabled || Boolean(blockedReason(rule))}
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
