import type { PaymentTranslationFunction } from './paymentMethodDisplay';
import { readZReportAccountCash, recordedCashRows, unresolvedCashRows } from './zReportAccountCash';
import { directionFor } from '@/lib/textDirection';

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

export function zReportAccountCashHtml(value: unknown, t: PaymentTranslationFunction, locale: string): string {
  const label = (key: string) => escapeHtml(t(key, key));
  const heading = `<h2>${label('cashier.zreport.account_cash_title')}</h2><p>${label('cashier.zreport.account_cash_scope')}</p>`;
  const report = readZReportAccountCash(value);
  const section = `<section class="account-cash" lang="${escapeHtml(locale)}" dir="${directionFor(locale)}">`;
  if (!report) return `${section}${heading}<p>${label('cashier.zreport.account_cash_unavailable')}</p></section>`;
  const table = (rows: string[][]) =>
    `<table><tbody>${rows
      .map(([key, amount]) => `<tr><td>${label(key)}</td><td>${escapeHtml(amount)}</td></tr>`)
      .join('')}</tbody></table>`;
  const recorded = report.byCurrency
    .map((row) => `<h4>${escapeHtml(row.currency)}</h4>${table(recordedCashRows(row, locale))}`)
    .join('');
  const unresolved = report.unresolvedByCurrency
    .map((row) => `<h4>${escapeHtml(row.currency)}</h4>${table(unresolvedCashRows(row, locale))}`)
    .join('');
  const recordedContent = recorded || `<p>${label('cashier.zreport.account_cash_no_recorded')}</p>`;
  const unresolvedContent = unresolved || `<p>${label('cashier.zreport.account_cash_no_unresolved')}</p>`;
  return `${section}${heading}<p>${label('cashier.zreport.account_cash_as_of')}: ${escapeHtml(new Date(report.snapshotAtUtc).toLocaleString(locale))}</p>
    <h3>${label('cashier.zreport.account_cash_recorded')}</h3>${recordedContent}
    <h3>${label('cashier.zreport.account_cash_unresolved')}</h3><p>${label('cashier.zreport.account_cash_unresolved_scope')}</p>${unresolvedContent}</section>`;
}
