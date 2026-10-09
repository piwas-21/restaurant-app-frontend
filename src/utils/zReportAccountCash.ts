import { zReportAccountCashSchema } from '@/schemas/zReportAccountCash.schema';
import type { ZReportAccountCashCurrency } from '@/types/order/zReportAccountCash';
import { formatCurrencyMinor } from './minorCurrency';

export function readZReportAccountCash(value: unknown) {
  const result = zReportAccountCashSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Exact minor-unit formatting also supports signed refund adjustments. */
export function formatZReportCashMinor(minor: number, currency: string, locale: string): string {
  const value = formatCurrencyMinor(Math.abs(minor), currency, locale);
  return minor < 0 ? `−${value}` : value;
}

export function recordedCashRows(row: ZReportAccountCashCurrency, locale: string) {
  const amount = (minor: number) => formatZReportCashMinor(minor, row.currency, locale);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  return [
    ['cashier.zreport.account_cash_collections', count(row.collectionCount)],
    ['cashier.zreport.account_cash_exact_collected', amount(row.collectedExactMinor)],
    ['cashier.zreport.account_cash_cash_received', amount(row.cashReceivedMinor)],
    ['cashier.zreport.account_cash_change_returned', amount(row.changeReturnedMinor)],
    ['cashier.zreport.account_cash_cash_due', amount(row.cashDueMinor)],
    ['cashier.zreport.account_cash_returns', count(row.returnCount)],
    ['cashier.zreport.account_cash_exact_refunded', amount(row.exactRefundedMinor)],
    ['cashier.zreport.account_cash_physical_returned', amount(row.physicalCashReturnedMinor)],
    ['cashier.zreport.account_cash_adjustment', amount(row.refundAdjustmentMinor)],
    ['cashier.zreport.account_cash_legacy_captures', count(row.legacyCaptureWithoutReceiptCount)],
    ['cashier.zreport.account_cash_legacy_capture_exact', amount(row.legacyCaptureExactMinor)],
    ['cashier.zreport.account_cash_legacy_returns', count(row.legacyReturnWithoutPhysicalEvidenceCount)],
    ['cashier.zreport.account_cash_legacy_refund_exact', amount(row.legacyExactRefundMinor)],
  ];
}

export function unresolvedCashRows(row: ZReportAccountCashCurrency, locale: string) {
  const amount = (minor: number) => formatZReportCashMinor(minor, row.currency, locale);
  return [
    ['cashier.zreport.account_cash_pending_returns', new Intl.NumberFormat(locale).format(row.unresolvedReturnCount)],
    ['cashier.zreport.account_cash_pending_exact', amount(row.unresolvedExactRefundMinor)],
    ['cashier.zreport.account_cash_pending_physical', amount(row.unconfirmedPhysicalCashMinor)],
  ];
}
