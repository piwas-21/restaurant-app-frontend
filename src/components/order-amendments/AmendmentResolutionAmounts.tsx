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
  const signedAmount = (minor: number) => {
    if (minor > 0) return `+${amount(minor)}`;
    if (minor < 0) return `−${amount(Math.abs(minor))}`;
    return amount(0);
  };
  return (
    <>
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
      <div className={styles.cashRefunds}>
        {value.refundLegs.map((leg) => {
          const cashRefund = leg.cashRefund ?? null;
          if (!cashRefund) return null;
          const cashReturn = 'cashReturn' in leg ? (leg.cashReturn ?? null) : null;
          return (
            <section className={styles.cashRefund} key={leg.paymentId}>
              <p className={styles.muted}>
                {t('orderAmendments.resolution_cash_refund_terms', {
                  originalExact: amount(cashRefund.originalExactAmountMinor),
                  originalDue: amount(cashRefund.originalDueAmountMinor),
                  previousExact: amount(cashRefund.previouslyRefundedExactMinor),
                  previousCash: amount(cashRefund.previouslyRefundedCashMinor),
                })}
              </p>
              <dl className={styles.cashAmounts}>
                <div>
                  <dt>{t('orderAmendments.resolution_cash_exact_refund')}</dt>
                  <dd>{amount(cashRefund.exactRefundAmountMinor)}</dd>
                </div>
                <div>
                  <dt>{t('orderAmendments.resolution_cash_return_amount')}</dt>
                  <dd>{amount(cashRefund.cashRefundAmountMinor)}</dd>
                </div>
                {cashReturn && (
                  <div>
                    <dt>{t('orderAmendments.resolution_cash_returned_amount')}</dt>
                    <dd>{amount(cashReturn.cashReturnedMinor)}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('orderAmendments.resolution_cash_refund_adjustment')}</dt>
                  <dd>{signedAmount(cashRefund.refundAdjustmentMinor)}</dd>
                </div>
                <div>
                  <dt>{t('orderAmendments.resolution_cash_retained_exact')}</dt>
                  <dd>{amount(cashRefund.retainedExactAmountMinor)}</dd>
                </div>
                <div>
                  <dt>{t('orderAmendments.resolution_cash_retained_due')}</dt>
                  <dd>{amount(cashRefund.retainedCashDueMinor)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </>
  );
}
