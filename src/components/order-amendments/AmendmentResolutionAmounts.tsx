'use client';

import { useTranslation } from 'react-i18next';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import type { AmendmentResolutionQuote, AmendmentResolutionResult } from '@/types/amendmentResolution';
import styles from './AmendmentResolution.module.css';

export default function AmendmentResolutionAmounts({
  value,
}: {
  readonly value: AmendmentResolutionQuote | AmendmentResolutionResult;
}) {
  const { t, i18n } = useTranslation();
  const amount = (minor: number) =>
    formatAccountPaymentMinor(minor, value.currency, i18n.language) ?? t('orderAmendments.currency_unavailable');
  return (
    <dl className={styles.amounts}>
      <div>
        <dt>{t('orderAmendments.resolution_credit')}</dt>
        <dd>{amount(value.creditMinor)}</dd>
      </div>
      <div>
        <dt>{t('orderAmendments.resolution_refund')}</dt>
        <dd>{amount(value.refundMinor)}</dd>
      </div>
      <div>
        <dt>{t('orderAmendments.resolution_waived')}</dt>
        <dd>{amount(value.unpaidWaivedMinor)}</dd>
      </div>
    </dl>
  );
}
