'use client';
import { MAX_BILL_CHARGE_FIELDS } from '@/lib/billChargeLimits';
import { useTranslation } from 'react-i18next';
import { useBillChargeEditor } from '@/hooks/admin/useBillChargeEditor';
import StaffButton from '@/components/design-system/StaffButton';
import BillChargeRuleEditor from './BillChargeRuleEditor';
import styles from '@/components/bill-charges/BillCharges.module.css';

export default function BillChargesTab() {
  const { t } = useTranslation();
  const editor = useBillChargeEditor();
  if (!editor.reader.configuration)
    return (
      <div>
        {editor.reader.message && <p role="alert">{editor.reader.message}</p>}
        <StaffButton onClick={() => void editor.reader.refresh()}>
          {t(editor.reader.failed ? 'retry' : 'loading')}
        </StaffButton>
      </div>
    );
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <h2>{t('billCharges.title')}</h2>
      <p>{t('billCharges.description')}</p>
      {editor.rules.map((rule, index) => (
        <BillChargeRuleEditor
          key={index}
          rule={rule}
          currency={editor.reader.configuration?.currency ?? ''}
          disabled={editor.busy}
          onRemove={
            ['service_fee', 'delivery_fee'].includes(rule.key)
              ? undefined
              : () => editor.setRules((values) => values.filter((_, i) => i !== index))
          }
          onChange={(next) => editor.setRules((values) => values.map((value, i) => (i === index ? next : value)))}
        />
      ))}
      <StaffButton
        disabled={editor.busy || editor.rules.length >= MAX_BILL_CHARGE_FIELDS}
        onClick={() =>
          editor.setRules((values) => [
            ...values,
            {
              key: `charge_${values.length + 1}`,
              label: t('billCharges.custom'),
              enabled: false,
              defaultAmount: 0,
              allowCustomAmount: true,
              orderTypes: ['DineIn', 'Takeaway', 'Delivery'],
              roles: ['Cashier', 'Server'],
            },
          ])
        }
      >
        {t('billCharges.addField')}
      </StaffButton>
      {!editor.valid && <p role="alert">{t('billCharges.invalidSettings')}</p>}
      {editor.message && <output aria-live="polite">{t(editor.message)}</output>}
      <StaffButton type="submit" variant="primary" disabled={editor.busy || !editor.valid}>
        {t('save')}
      </StaffButton>
    </form>
  );
}
