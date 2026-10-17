'use client';

import { Plus } from 'lucide-react';
import type { BillChargeRule } from '@/types/billCharge';
import { MAX_BILL_CHARGE_FIELDS } from '@/lib/billChargeLimits';
import { useTranslation } from 'react-i18next';
import { useBillChargeEditor } from '@/hooks/admin/useBillChargeEditor';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import BillChargeConfigurationNotice from '@/components/bill-charges/BillChargeConfigurationNotice';
import BillChargeIcon from '@/components/bill-charges/BillChargeIcon';
import BillChargeRuleEditor from './BillChargeRuleEditor';
import styles from './BillChargesTab.module.css';

function chargeModeKey(rule: BillChargeRule) {
  return rule.allowCustomAmount ? 'billCharges.staffAmount' : 'billCharges.fixedAmount';
}

export default function BillChargesTab() {
  const { t } = useTranslation();
  const editor = useBillChargeEditor();
  if (!editor.reader.configuration) return <BillChargeConfigurationNotice reader={editor.reader} />;
  const index = editor.selectedIndex;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <header className={styles.heading}>
        <h2>{t('billCharges.title')}</h2>
        <p>{t('billCharges.intro')}</p>
      </header>
      <div className={styles.layout}>
        <nav className={styles.list} aria-label={t('billCharges.yourCharges')}>
          {editor.rules.map((rule, position) => (
            <button
              key={editor.rowIds[position]}
              type="button"
              className={styles.option}
              aria-pressed={index === position}
              disabled={editor.busy}
              onClick={() => editor.selectRule(rule.key)}
            >
              <span className={styles.icon}>
                <BillChargeIcon chargeKey={rule.key} />
              </span>
              <span>
                <strong dir="auto">{rule.label}</strong>
                {rule.enabled ? (
                  <small>{t(chargeModeKey(rule))}</small>
                ) : (
                  <StatusBadge tone="neutral" size="sm">
                    {t('billCharges.disabled')}
                  </StatusBadge>
                )}
              </span>
            </button>
          ))}
          <StaffButton
            className={styles.add}
            disabled={editor.busy || editor.rules.length >= MAX_BILL_CHARGE_FIELDS}
            onClick={editor.addCustomRule}
          >
            <Plus size={18} aria-hidden="true" />
            {t('billCharges.addCustom')}
          </StaffButton>
        </nav>
        <div className={styles.editors}>
          {editor.rules.map((rule, position) => (
            <div key={editor.rowIds[position]} hidden={index !== position}>
              <BillChargeRuleEditor
                rule={rule}
                currency={editor.reader.configuration?.currency ?? ''}
                disabled={editor.busy}
                onRemove={
                  ['service_fee', 'delivery_fee'].includes(rule.key) ? undefined : () => editor.removeRule(position)
                }
                onChange={(next) => editor.changeRule(position, next)}
                onAmountValidityChange={(valid) => editor.setAmountValid(rule.key, valid)}
              />
            </div>
          ))}
        </div>
      </div>
      {!editor.valid && (
        <p className={styles.error} role="alert">
          {t('billCharges.settingsHelp')}
        </p>
      )}
      {editor.message && <output aria-live="polite">{t(editor.message)}</output>}
      <div className={styles.footer}>
        <small>{t('billCharges.staffChoice')}</small>
        <StaffButton type="submit" variant="primary" disabled={editor.busy || !editor.valid}>
          {t('save')}
        </StaffButton>
      </div>
      <details className={styles.printerNote}>
        <summary>{t('billCharges.printing')}</summary>
        <p>{t('billCharges.printerHelp')}</p>
      </details>
    </form>
  );
}
