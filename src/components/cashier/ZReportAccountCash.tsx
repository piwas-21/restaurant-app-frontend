'use client';

import { useTranslation } from 'react-i18next';
import type { ZReportAccountCashMovements } from '@/types/order/zReportAccountCash';
import { readZReportAccountCash, recordedCashRows, unresolvedCashRows } from '@/utils/zReportAccountCash';
import styles from './ZReportAccountCash.module.css';

interface Props {
  movements?: ZReportAccountCashMovements | null;
}

export default function ZReportAccountCash({ movements }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || 'en';
  const report = readZReportAccountCash(movements);
  return (
    <section className={styles.section} aria-label={t('cashier.zreport.account_cash_title')}>
      <h3>{t('cashier.zreport.account_cash_title')}</h3>
      <p>{t('cashier.zreport.account_cash_scope')}</p>
      {!report ? (
        <p role="status">{t('cashier.zreport.account_cash_unavailable')}</p>
      ) : (
        <>
          <p>
            {t('cashier.zreport.account_cash_as_of')}:{' '}
            <time dateTime={report.snapshotAtUtc}>{new Date(report.snapshotAtUtc).toLocaleString(locale)}</time>
          </p>
          <h4>{t('cashier.zreport.account_cash_recorded')}</h4>
          {report.byCurrency.map((row) => (
            <section key={row.currency} aria-label={row.currency}>
              <h5>
                <bdi>{row.currency}</bdi>
              </h5>
              <dl className={styles.figures}>
                {recordedCashRows(row, locale).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>
                      <bdi>{value}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {report.byCurrency.length === 0 && <p>{t('cashier.zreport.account_cash_no_recorded')}</p>}
          <h4>{t('cashier.zreport.account_cash_unresolved')}</h4>
          <p>{t('cashier.zreport.account_cash_unresolved_scope')}</p>
          {report.unresolvedByCurrency.map((row) => (
            <section key={row.currency} aria-label={row.currency}>
              <h5>
                <bdi>{row.currency}</bdi>
              </h5>
              <dl className={styles.figures}>
                {unresolvedCashRows(row, locale).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>
                      <bdi>{value}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {report.unresolvedByCurrency.length === 0 && <p>{t('cashier.zreport.account_cash_no_unresolved')}</p>}
        </>
      )}
    </section>
  );
}
