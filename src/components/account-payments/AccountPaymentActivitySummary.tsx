'use client';

import { useTranslation } from 'react-i18next';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import type { AccountPaymentAttemptSummary } from '@/types/accountPaymentAccount';
import styles from './AccountPaymentCollection.module.css';

interface Props {
  readonly capturedMinor: number;
  readonly attempts: AccountPaymentAttemptSummary[];
  readonly currency: string;
}

export default function AccountPaymentActivitySummary({ capturedMinor, attempts, currency }: Props) {
  const { t, i18n } = useTranslation();
  const money = (minor: number, itemCurrency = currency) =>
    formatAccountPaymentMinor(minor, itemCurrency, i18n.language || 'en') ?? t('cashier.tables.currency_unknown');

  return (
    <section className={styles.activity} aria-label={t('accountPayments.active_attempts')}>
      <dl className={styles.summary}>
        <div>
          <dt>{t('accountPayments.captured')}</dt>
          <dd>{money(capturedMinor)}</dd>
        </div>
      </dl>
      {attempts.length > 0 && (
        <>
          <h4>{t('accountPayments.active_attempts')}</h4>
          <ul className={styles.attempts}>
            {attempts.map((attempt, index) => (
              <li key={`${attempt.state}:${attempt.version}:${index}`} className={styles.attempt}>
                <strong>{t(`accountPayments.state.${attempt.state}`)}</strong>
                <span className={styles.attemptMeta}>
                  {money(attempt.amountMinor, attempt.currency)} ·{' '}
                  {t(attempt.paymentMethod === 'Cash' ? 'accountPayments.method_cash' : 'accountPayments.method_card')}{' '}
                  · {t(attempt.isOwnOperation ? 'accountPayments.own_attempt' : 'accountPayments.other_cashier')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
