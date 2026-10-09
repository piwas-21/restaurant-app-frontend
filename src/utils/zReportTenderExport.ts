import type { ZReportDto } from '@/types/order';
import { formatCurrency } from '@/utils/currency';
import type { PaymentTranslationFunction } from './paymentMethodDisplay';
import { getPaymentMethodLabel } from './paymentMethodDisplay';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );

const formatAmount = (amount: number, currency?: string | null, locale = 'en'): string =>
  formatCurrency(amount, locale, currency || undefined);

export function zReportTenderHtml(report: ZReportDto, t: PaymentTranslationFunction, locale: string): string {
  const label = (key: string, fallback: string) => escapeHtml(t(key, fallback));
  const paymentRows = report.paymentsByMethod
    .map(
      (payment) => `<tr><td>${escapeHtml(getPaymentMethodLabel(payment.paymentMethod, t))}</td>
      <td>${escapeHtml(payment.currency || label('cashier.zreport.currency_unavailable', 'Currency unavailable'))}</td>
      <td>${payment.transactionCount}</td>
      <td>${escapeHtml(formatAmount(payment.orderAmount ?? payment.totalAmount, payment.currency, locale))}</td>
      <td>${escapeHtml(formatAmount(payment.tipAmount ?? 0, payment.currency, locale))}</td>
      <td>${escapeHtml(formatAmount(payment.totalAmount, payment.currency, locale))}</td></tr>`,
    )
    .join('');
  const currencyRows = (items: NonNullable<ZReportDto['staffTipsCollected']>, key: string, fallback: string) =>
    items
      .map(
        (row) => `<tr><td>${label(key, fallback)}</td>
      <td>${escapeHtml(row.currency || label('cashier.zreport.currency_unavailable', 'Currency unavailable'))}</td>
      <td>${escapeHtml(formatAmount(row.amountMinor / 100, row.currency, locale))}</td></tr>`,
      )
      .join('');
  const summaryRows = [
    currencyRows(report.staffTipsCollected ?? [], 'cashier.zreport.staff_tips_collected', 'Staff tips collected'),
    currencyRows(report.staffTipsRefunded ?? [], 'cashier.zreport.staff_tips_refunded', 'Staff tips refunded'),
    currencyRows(report.netCashCollected ?? [], 'cashier.zreport.net_cash_collected', 'Net cash collected'),
  ].join('');

  return `<section class="section">
    <div class="section-title">${label('cashier.zreport.payment_methods', 'Sales by Payment Method')}</div>
    ${
      paymentRows
        ? `<table><thead><tr>
      <th>${label('cashier.zreport.payment_method', 'Method')}</th>
      <th>${label('cashier.zreport.currency', 'Currency')}</th>
      <th>${label('cashier.zreport.transactions', 'Txns')}</th>
      <th>${label('cashier.zreport.order_amount', 'Order amount')}</th>
      <th>${label('cashier.zreport.staff_tip_amount', 'Staff tip')}</th>
      <th>${label('cashier.zreport.total', 'Total')}</th>
    </tr></thead><tbody>${paymentRows}</tbody></table>`
        : `<p>${label('cashier.zreport.no_data', 'No payments')}</p>`
    }
  </section>
  ${
    summaryRows
      ? `<section class="section">
    <div class="section-title">${label('cashier.zreport.tender_summary', 'Tender summary')}</div>
    <table><tbody>${summaryRows}</tbody></table>
    <p>${label('cashier.zreport.net_cash_collected_note', 'Net recorded cash movements; excludes opening float and physical cash counts.')}</p>
  </section>`
      : ''
  }`;
}
