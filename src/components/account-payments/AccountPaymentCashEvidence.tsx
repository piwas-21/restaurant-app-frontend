'use client';

import { useTranslation } from 'react-i18next';
import { readAccountCashEvidence } from '@/lib/accountCashEvidence';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import styles from './AccountPaymentCollection.module.css';

interface AccountPaymentCashEvidenceProps {
  readonly operation: AccountPaymentOperation;
}

export default function AccountPaymentCashEvidence({ operation }: AccountPaymentCashEvidenceProps) {
  const { t, i18n } = useTranslation();
  if (operation.paymentMethod !== 'Cash') return null;
  const evidence = readAccountCashEvidence(operation);
  if (evidence.status !== 'valid') {
    const legacy = evidence.status === 'missing' && operation.state === 'Captured';
    return (
      <p role="alert" className={styles.warning}>
        {t(legacy ? 'accountPayments.cash.legacy_unattested' : 'accountPayments.cash.evidence_unavailable')}
      </p>
    );
  }
  const { settlement, receipt } = evidence;
  const money = (minor: number) =>
    formatAccountPaymentMinor(minor, operation.currency, i18n.language || 'en') ?? t('cashier.tables.currency_unknown');
  const adjustment = money(Math.abs(settlement.adjustmentMinor));
  const signedAdjustment = settlement.adjustmentMinor < 0 ? `−${adjustment}` : adjustment;
  return (
    <div className={styles.cash}>
      <dl className={styles.summary}>
        <div>
          <dt>{t('accountPayments.cash.exact_charge')}</dt>
          <dd>{money(settlement.exactAmountMinor)}</dd>
        </div>
        <div>
          <dt>{t('accountPayments.cash.rounding_adjustment')}</dt>
          <dd dir="auto">{signedAdjustment}</dd>
        </div>
        <div>
          <dt>{t('accountPayments.cash.due')}</dt>
          <dd>{money(settlement.dueAmountMinor)}</dd>
        </div>
      </dl>
      {settlement.adjustmentMinor !== 0 && <p className={styles.note}>{t('accountPayments.cash.rounding_note')}</p>}
      {receipt && (
        <div>
          <h5>{t('accountPayments.cash.receipt')}</h5>
          <dl className={styles.summary}>
            <div>
              <dt>{t('cashier.cash_received')}</dt>
              <dd>{money(receipt.receivedMinor)}</dd>
            </div>
            <div>
              <dt>{t('cashier.cash_change')}</dt>
              <dd>{money(receipt.changeMinor)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
