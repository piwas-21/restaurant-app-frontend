'use client';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { BillChargeRule } from '@/types/billCharge';
import styles from '@/components/bill-charges/BillCharges.module.css';

export default function BillChargeRuleEditor({
  rule,
  currency,
  onChange,
  disabled,
  onRemove,
}: Readonly<{
  rule: BillChargeRule;
  currency: string;
  onChange: (rule: BillChargeRule) => void;
  disabled: boolean;
  onRemove: () => void;
}>) {
  const { t } = useTranslation();
  const toggle = (field: 'roles' | 'orderTypes', value: string, checked: boolean) =>
    onChange({ ...rule, [field]: checked ? [...rule[field], value] : rule[field].filter((item) => item !== value) });
  return (
    <fieldset className={styles.rule} disabled={disabled}>
      <legend dir="auto">{rule.label}</legend>
      <CheckboxField
        label={t('billCharges.enabled')}
        checked={rule.enabled}
        onChange={(enabled) => onChange({ ...rule, enabled })}
      />
      <FormField label={t('billCharges.key')}>
        <input value={rule.key} maxLength={40} onChange={(e) => onChange({ ...rule, key: e.target.value })} />
      </FormField>
      <FormField label={t('billCharges.label')}>
        <input value={rule.label} maxLength={60} onChange={(e) => onChange({ ...rule, label: e.target.value })} />
      </FormField>
      <FormField label={`${t('billCharges.defaultAmount')} (${currency})`}>
        <input
          type="number"
          min="0"
          max="10000"
          step="0.01"
          value={rule.defaultAmount}
          onChange={(e) => onChange({ ...rule, defaultAmount: Number(e.target.value) })}
        />
      </FormField>
      <CheckboxField
        label={t('billCharges.allowCustom')}
        checked={rule.allowCustomAmount}
        onChange={(allowCustomAmount) => onChange({ ...rule, allowCustomAmount })}
      />
      <fieldset className={styles.options}>
        <legend>{t('order_types')}</legend>
        {[
          ['DineIn', 'order_type_dine_in'],
          ['Takeaway', 'takeaway'],
          ['Delivery', 'delivery'],
        ].map(([value, key]) => (
          <CheckboxField
            key={value}
            label={t(key)}
            checked={rule.orderTypes.includes(value)}
            onChange={(checked) => toggle('orderTypes', value, checked)}
          />
        ))}
      </fieldset>
      <fieldset className={styles.options}>
        <legend>{t('billCharges.staff')}</legend>
        {[
          ['Cashier', 'cashier'],
          ['Server', 'server'],
        ].map(([value, key]) => (
          <CheckboxField
            key={value}
            label={t(key)}
            checked={rule.roles.includes(value)}
            onChange={(checked) => toggle('roles', value, checked)}
          />
        ))}
      </fieldset>
      <StaffButton onClick={onRemove}>{t('remove')}</StaffButton>
    </fieldset>
  );
}
