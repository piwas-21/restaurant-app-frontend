'use client';

import { Check, CreditCard, ShoppingBag, Truck, UserRound, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BILL_CHARGE_LABEL_MAX_LENGTH } from '@/lib/billChargeLimits';
import StaffButton from '@/components/design-system/StaffButton';
import FormField from '@/components/design-system/FormField';
import BillChargeAmountInput from '@/components/bill-charges/BillChargeAmountInput';
import BillChargeIcon from '@/components/bill-charges/BillChargeIcon';
import type { BillChargeRule } from '@/types/billCharge';
import controls from '@/components/bill-charges/BillChargeControls.module.css';
import styles from './BillChargeRuleEditor.module.css';

interface Props {
  readonly rule: BillChargeRule;
  readonly currency: string;
  readonly onChange: (rule: BillChargeRule) => void;
  readonly disabled: boolean;
  readonly onRemove?: () => void;
  readonly onAmountValidityChange: (valid: boolean) => void;
}

export default function BillChargeRuleEditor({
  rule,
  currency,
  onChange,
  disabled,
  onRemove,
  onAmountValidityChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const toggle = (field: 'roles' | 'orderTypes', value: string) =>
    onChange({
      ...rule,
      [field]: (rule[field] as readonly string[]).includes(value)
        ? rule[field].filter((item) => item !== value)
        : [...rule[field], value],
    });
  const amount = currency
    ? new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency }).format(rule.defaultAmount)
    : rule.defaultAmount;
  return (
    <section className={styles.editor} aria-label={rule.label}>
      <header className={styles.header}>
        <span className={styles.icon}>
          <BillChargeIcon chargeKey={rule.key} />
        </span>
        <div>
          <h3 dir="auto">{rule.label}</h3>
          <p>{t(rule.enabled ? 'billCharges.available' : 'billCharges.hidden')}</p>
        </div>
        <button
          type="button"
          className={styles.toggle}
          role="switch"
          aria-checked={rule.enabled}
          aria-label={t('billCharges.enableCharge', { label: rule.label })}
          disabled={disabled}
          onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
        >
          <span />
        </button>
      </header>
      <div className={styles.fields}>
        <div className={styles.nameAmount}>
          <div>
            <FormField label={t('billCharges.billName')}>
              <input
                className={styles.nameInput}
                value={rule.label}
                maxLength={BILL_CHARGE_LABEL_MAX_LENGTH}
                disabled={disabled}
                dir="auto"
                onChange={(event) => onChange({ ...rule, label: event.target.value })}
              />
            </FormField>
            <p className={styles.help}>{t('billCharges.nameHelp')}</p>
          </div>
          <BillChargeAmountInput
            label={t(rule.allowCustomAmount ? 'billCharges.suggestedAmount' : 'billCharges.fixedAmount')}
            currency={currency}
            value={rule.defaultAmount}
            disabled={disabled}
            onChange={(defaultAmount) => onChange({ ...rule, defaultAmount })}
            onValidityChange={onAmountValidityChange}
          />
        </div>
        <fieldset className={controls.group}>
          <legend className={styles.label}>{t('billCharges.amountMode')}</legend>
          <div className={styles.segments}>
            {[false, true].map((custom) => (
              <button
                key={String(custom)}
                type="button"
                disabled={disabled}
                aria-pressed={rule.allowCustomAmount === custom}
                onClick={() => onChange({ ...rule, allowCustomAmount: custom })}
              >
                {custom ? <UserRound size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}
                {t(custom ? 'billCharges.staffAmount' : 'billCharges.fixedAmount')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={controls.group}>
          <legend className={styles.label}>{t('billCharges.availableFor')}</legend>
          <div className={controls.chips}>
            {(
              [
                ['DineIn', 'order_type_dine_in', UtensilsCrossed],
                ['Takeaway', 'takeaway', ShoppingBag],
                ['Delivery', 'delivery', Truck],
              ] as const
            ).map(([value, key, Icon]) => (
              <button
                type="button"
                className={controls.chip}
                key={value}
                aria-pressed={rule.orderTypes.includes(value)}
                disabled={disabled}
                onClick={() => toggle('orderTypes', value)}
              >
                {rule.orderTypes.includes(value) ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Icon size={16} aria-hidden="true" />
                )}
                {t(key)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={controls.group}>
          <legend className={styles.label}>{t('billCharges.whoCanAdd')}</legend>
          <div className={controls.chips}>
            {(['Cashier', 'Server'] as const).map((role) => (
              <button
                type="button"
                className={controls.chip}
                key={role}
                aria-pressed={rule.roles.includes(role)}
                disabled={disabled}
                onClick={() => toggle('roles', role)}
              >
                {rule.roles.includes(role) ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <UserRound size={16} aria-hidden="true" />
                )}
                {t(role === 'Cashier' ? 'billCharges.cashierRole' : 'billCharges.serverRole')}
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.receipt}>
          <small>{t('billCharges.receiptPreview')}</small>
          <span dir="auto">{rule.label}</span>
          <strong>{amount}</strong>
        </div>
        {onRemove && (
          <StaffButton onClick={onRemove} disabled={disabled}>
            {t('billCharges.removeCharge')}
          </StaffButton>
        )}
      </div>
    </section>
  );
}
