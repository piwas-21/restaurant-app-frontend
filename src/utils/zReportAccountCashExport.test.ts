import { accountCashReport } from '../test-utils/zReportAccountCash';
import { zReportAccountCashHtml } from './zReportAccountCashExport';

it('prints exact/physical/legacy/current-pending labels and escapes every new HTML value', () => {
  const html = zReportAccountCashHtml(accountCashReport(), (key) => `<script>${key}&"'</script>`, 'en');
  expect(html).toContain('cashier.zreport.account_cash_scope');
  expect(html).toContain('cashier.zreport.account_cash_exact_collected');
  expect(html).toContain('cashier.zreport.account_cash_pending_physical');
  expect(html).toContain('CHF 3.33');
  expect(html).toContain('CHF 3.35');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('&amp;&quot;&#39;');
  expect(html).not.toContain('<script>');
});

it('prints a coverage gap for absent or invalid data without inventing amounts', () => {
  for (const value of [undefined, null, { ...accountCashReport(), coversWholeRestaurantTill: true }]) {
    const html = zReportAccountCashHtml(value, (key) => key, 'en');
    expect(html).toContain('cashier.zreport.account_cash_unavailable');
    expect(html).not.toContain('CHF');
  }
});

it('prints regioned Arabic using the supplied locale and reading direction', () => {
  const html = zReportAccountCashHtml(accountCashReport(), (key) => key, 'ar-EG');
  expect(html).toContain('lang="ar-EG" dir="rtl"');
  expect(html).toContain('٣٫٣٣');
});
