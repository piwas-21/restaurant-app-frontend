import type { ZReportAccountCashCurrency, ZReportAccountCashMovements } from '@/types/order/zReportAccountCash';

export function cashReportRow(overrides: Partial<ZReportAccountCashCurrency> = {}): ZReportAccountCashCurrency {
  return {
    currency: 'CHF',
    collectionCount: 0,
    collectedExactMinor: 0,
    cashReceivedMinor: 0,
    changeReturnedMinor: 0,
    cashDueMinor: 0,
    returnCount: 0,
    exactRefundedMinor: 0,
    physicalCashReturnedMinor: 0,
    refundAdjustmentMinor: 0,
    legacyCaptureWithoutReceiptCount: 0,
    legacyCaptureExactMinor: 0,
    legacyReturnWithoutPhysicalEvidenceCount: 0,
    legacyExactRefundMinor: 0,
    unresolvedReturnCount: 0,
    unresolvedExactRefundMinor: 0,
    unconfirmedPhysicalCashMinor: 0,
    ...overrides,
  };
}

export function accountCashReport(overrides: Partial<ZReportAccountCashMovements> = {}): ZReportAccountCashMovements {
  return {
    snapshotAtUtc: '2026-10-04T05:00:00Z',
    coverage: 'Table-account cash only',
    coversWholeRestaurantTill: false,
    byCurrency: [
      cashReportRow({
        collectionCount: 1,
        collectedExactMinor: 333,
        cashReceivedMinor: 400,
        changeReturnedMinor: 65,
        cashDueMinor: 335,
        returnCount: 1,
        exactRefundedMinor: 333,
        physicalCashReturnedMinor: 335,
        refundAdjustmentMinor: 2,
      }),
    ],
    unresolvedByCurrency: [
      cashReportRow({ unresolvedReturnCount: 1, unresolvedExactRefundMinor: 101, unconfirmedPhysicalCashMinor: 100 }),
    ],
    ...overrides,
  };
}
