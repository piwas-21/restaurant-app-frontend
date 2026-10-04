import { render, screen, within } from '@testing-library/react';
import { accountCashReport, cashReportRow } from '../../test-utils/zReportAccountCash';
import ZReportAccountCash from './ZReportAccountCash';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));

it('renders recorded, legacy and current unresolved figures with separate labels and scope', () => {
  render(
    <ZReportAccountCash
      movements={accountCashReport({
        byCurrency: [
          cashReportRow({
            ...accountCashReport().byCurrency[0],
            legacyCaptureWithoutReceiptCount: 2,
            legacyCaptureExactMinor: 700,
            legacyReturnWithoutPhysicalEvidenceCount: 1,
            legacyExactRefundMinor: 150,
          }),
        ],
      })}
    />,
  );
  expect(screen.getByText('cashier.zreport.account_cash_scope')).toBeInTheDocument();
  const received = screen.getByText('cashier.zreport.account_cash_cash_received').parentElement!;
  const changed = screen.getByText('cashier.zreport.account_cash_change_returned').parentElement!;
  expect(within(received).getByText('CHF 4.00')).toBeInTheDocument();
  expect(within(changed).getByText('CHF 0.65')).toBeInTheDocument();
  expect(screen.getByText('cashier.zreport.account_cash_legacy_capture_exact')).toBeInTheDocument();
  expect(screen.getByText('cashier.zreport.account_cash_unresolved_scope')).toBeInTheDocument();
  expect(
    within(screen.getByText('cashier.zreport.account_cash_pending_physical').parentElement!).getByText('CHF 1.00'),
  ).toBeInTheDocument();
  expect(screen.getByRole('time').getAttribute('datetime')).toBe('2026-10-04T05:00:00Z');
});

it('keeps an older missing receipt report visibly incomplete instead of showing a complete zero', () => {
  render(<ZReportAccountCash />);
  expect(screen.getByRole('status')).toHaveTextContent('cashier.zreport.account_cash_unavailable');
  expect(screen.queryByText('CHF 0.00')).not.toBeInTheDocument();
});

it('labels empty report-day movements separately from the current all-date unresolved snapshot', () => {
  render(<ZReportAccountCash movements={accountCashReport({ byCurrency: [], unresolvedByCurrency: [] })} />);
  expect(screen.getByText('cashier.zreport.account_cash_no_recorded')).toBeInTheDocument();
  expect(screen.getByText('cashier.zreport.account_cash_no_unresolved')).toBeInTheDocument();
});
