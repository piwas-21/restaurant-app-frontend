'use client';

import { useTranslation } from 'react-i18next';
import type { ZReportCurrencyAmount, ZReportDto } from '@/types/order/zReport';
import { formatCurrency } from '@/utils/currency';
import styles from './ZReportModal.module.css';

interface Props {
  readonly report: ZReportDto;
}

function formatMinorAmount(value: ZReportCurrencyAmount, locale: string, unknownCurrency: string): string {
  const amount = value.amountMinor / 100;
  return value.currency
    ? formatCurrency(amount, locale, value.currency, 2)
    : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${unknownCurrency}`;
}

export default function ZReportTenderSummary({ report }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || 'en';
  const collected = report.staffTipsCollected ?? [];
  const refunded = report.staffTipsRefunded ?? [];
  const cash = report.netCashCollected ?? [];
  const hasRows = collected.length > 0 || refunded.length > 0 || cash.length > 0;

  if (!hasRows) return null;

  const rows = [
    ...collected.map((value) => [t('cashier.zreport.staff_tips_collected'), value] as const),
    ...refunded.map((value) => [t('cashier.zreport.staff_tips_refunded'), value] as const),
    ...cash.map((value) => [t('cashier.zreport.net_cash_collected'), value] as const),
  ];

  return (
    <section className={styles.section} aria-label={t('cashier.zreport.tender_summary')}>
      <h3 className={styles.sectionTitle}>{t('cashier.zreport.tender_summary')}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('cashier.zreport.category')}</th>
            <th>{t('cashier.zreport.currency')}</th>
            <th>{t('cashier.zreport.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={`${label}-${value.currency ?? 'unknown'}-${index}`}>
              <td>{label}</td>
              <td>{value.currency ?? t('cashier.zreport.currency_unavailable')}</td>
              <td>{formatMinorAmount(value, locale, t('cashier.zreport.currency_unavailable'))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t('cashier.zreport.net_cash_collected_note')}</p>
    </section>
  );
}
