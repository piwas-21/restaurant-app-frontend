'use client';
import { useTranslation } from 'react-i18next';
import { MAX_BILL_CHARGE_PERCENTAGE } from '@/lib/billChargeLimits';
import type { BillChargeRule } from '@/types/billCharge';
import controls from '@/components/bill-charges/BillChargeControls.module.css';
import styles from './BillChargeRuleEditor.module.css';

export default function BillChargeRuleModes({
  rule,
  onChange,
  disabled,
}: Readonly<{
  rule: BillChargeRule;
  onChange: (rule: BillChargeRule) => void;
  disabled: boolean;
}>) {
  const { t } = useTranslation();
  return (
    <>
      <fieldset className={controls.group}>
        <legend className={styles.label}>{t('billCharges.effect')}</legend>
        <div className={styles.segments}>
          {(['Increase', 'Reduce'] as const).map((effect) => (
            <button
              type="button"
              key={effect}
              disabled={disabled}
              aria-pressed={(rule.effect ?? 'Increase') === effect}
              onClick={() => onChange({ ...rule, effect })}
            >
              {t(effect === 'Reduce' ? 'billCharges.reduce' : 'billCharges.increase')}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={controls.group}>
        <legend className={styles.label}>{t('billCharges.calculation')}</legend>
        <div className={styles.segments}>
          {(['Fixed', 'Percentage'] as const).map((calculation) => (
            <button
              type="button"
              key={calculation}
              disabled={disabled}
              aria-pressed={(rule.calculation ?? 'Fixed') === calculation}
              onClick={() =>
                onChange({
                  ...rule,
                  calculation,
                  defaultAmount:
                    calculation === 'Percentage'
                      ? Math.min(MAX_BILL_CHARGE_PERCENTAGE, rule.defaultAmount)
                      : rule.defaultAmount,
                })
              }
            >
              {t(calculation === 'Percentage' ? 'billCharges.percentage' : 'billCharges.fixedValue')}
            </button>
          ))}
        </div>
      </fieldset>
      <p className={styles.help}>{t('billCharges.itemBasisHelp')}</p>
    </>
  );
}
