import { cashReportRow, accountCashReport } from '../test-utils/zReportAccountCash';
import {
  formatZReportCashMinor,
  readZReportAccountCash,
  recordedCashRows,
  unresolvedCashRows,
} from './zReportAccountCash';

describe('table-account cash report integrity', () => {
  it('keeps exact 333, cash 335, received 400 and change 65 separate from expected returns', () => {
    const result = readZReportAccountCash(accountCashReport());
    expect(result).toEqual(accountCashReport());
    expect(recordedCashRows(result!.byCurrency[0], 'en')).toEqual(
      expect.arrayContaining([
        ['cashier.zreport.account_cash_exact_collected', 'CHF 3.33'],
        ['cashier.zreport.account_cash_cash_due', 'CHF 3.35'],
        ['cashier.zreport.account_cash_change_returned', 'CHF 0.65'],
      ]),
    );
    expect(unresolvedCashRows(result!.unresolvedByCurrency[0], 'en')).toContainEqual([
      'cashier.zreport.account_cash_pending_physical',
      'CHF 1.00',
    ]);
  });

  it('accepts a zero physical cash return with a negative adjustment and separates currencies', () => {
    const report = accountCashReport({
      byCurrency: [
        cashReportRow({ returnCount: 1, exactRefundedMinor: 1, refundAdjustmentMinor: -1 }),
        cashReportRow({
          currency: 'EUR',
          collectionCount: 1,
          collectedExactMinor: 334,
          cashReceivedMinor: 400,
          changeReturnedMinor: 66,
          cashDueMinor: 334,
        }),
      ],
    });
    expect(readZReportAccountCash(report)).toEqual(report);
    expect(formatZReportCashMinor(-1, 'CHF', 'en')).toBe('−CHF 0.01');
    expect(formatZReportCashMinor(0, 'EUR', 'en')).toBe('€0.00');
  });

  it.each([undefined, null, {}, { coversWholeRestaurantTill: true }])(
    'does not turn absent or incomplete coverage into zero cash (%p)',
    (value) => {
      expect(readZReportAccountCash(value)).toBeNull();
    },
  );

  it.each([
    { cashReceivedMinor: 401 },
    { physicalCashReturnedMinor: 334 },
    { currency: '<x>' },
    { collectionCount: -1 },
    { exactRefundedMinor: Number.MAX_SAFE_INTEGER + 1 },
    { cashReceivedMinor: 1.5 },
    { cashReceivedMinor: Infinity },
    { refundAdjustmentMinor: NaN },
  ])('holds malformed or nonconserving values without throwing (%p)', (override) => {
    expect(
      readZReportAccountCash(
        accountCashReport({ byCurrency: [cashReportRow({ ...accountCashReport().byCurrency[0], ...override })] }),
      ),
    ).toBeNull();
  });

  it('rejects duplicate currencies and invalid timestamps', () => {
    expect(readZReportAccountCash(accountCashReport({ byCurrency: [cashReportRow(), cashReportRow()] }))).toBeNull();
    expect(readZReportAccountCash(accountCashReport({ snapshotAtUtc: 'not a date' }))).toBeNull();
  });

  it('refuses a current unresolved amount presented as a report-day movement or the reverse', () => {
    expect(
      readZReportAccountCash(accountCashReport({ byCurrency: [cashReportRow({ unresolvedReturnCount: 1 })] })),
    ).toBeNull();
    expect(
      readZReportAccountCash(accountCashReport({ unresolvedByCurrency: [cashReportRow({ collectionCount: 1 })] })),
    ).toBeNull();
  });

  it('formats a fixed safe integer without floating-point loss in the minor digits', () => {
    expect(formatZReportCashMinor(9007199254740991, 'CHF', 'en')).toBe('CHF 90,071,992,547,409.91');
  });
});
