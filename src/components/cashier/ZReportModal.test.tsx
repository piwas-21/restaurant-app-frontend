/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ZReportModal from './ZReportModal';
import { getZReport } from '@/services/orderService';
import { ApiError } from '@/utils/apiClient';
import { ZReportDto } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/services/orderService', () => ({ getZReport: jest.fn() }));
jest.mock('@/utils/zReportExportUtils', () => ({ exportZReportToPDF: jest.fn() }));

const mockGetZReport = getZReport as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('ZReportModal — why the report did not load (E9)', () => {
  it('shows the server’s own refusal', async () => {
    // The reasons a Z-report is refused are ones a cashier can act on — a date outside the till's
    // range, or a session that lapsed mid-shift. "Failed to load Z-Report" told them neither.
    mockGetZReport.mockRejectedValue(new ApiError(400, 'No till session was open on that date'));
    render(<ZReportModal isOpen onClose={jest.fn()} />);

    expect(await screen.findByText('No till session was open on that date')).toBeInTheDocument();
    expect(screen.queryByText('cashier.zreport.error')).not.toBeInTheDocument();
  });

  it('falls back to the translated sentence when the server authored none', async () => {
    // `getZReport` throws a plain `Error('Failed to fetch Z-Report')` for a 200 with no body.
    // `getErrorMessage` returns null for a non-`ApiError`, so that English literal must not show.
    mockGetZReport.mockRejectedValue(new Error('Failed to fetch Z-Report'));
    render(<ZReportModal isOpen onClose={jest.fn()} />);

    expect(await screen.findByText('cashier.zreport.error')).toBeInTheDocument();
  });
});

// The day the device would have named, exactly as this component used to compute it. Anchored to
// the REAL instant rather than a literal date: a literal is a day that is in the past or the
// future on both clocks, so it cannot distinguish them (the lesson from backend #372 / #369).
const deviceDay = (): string => new Date().toISOString().split('T')[0];

// A day that is neither the device's UTC day nor its local day, whatever zone the device is in.
const dayAfterTheDeviceDay = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
};

// `transactions` is the settle signal: the picker's own value moves the instant a date is CHOSEN,
// before the request is even sent, so waiting on it proves nothing about the answer. A figure that
// only the response can produce is what says the answer has landed.
const reportFor = (day: string, transactions = 0): ZReportDto => ({
  reportDate: `${day}T00:00:00Z`,
  generatedAt: new Date().toISOString(),
  totalTransactions: transactions,
  grossSales: 0,
  netSales: 0,
  totalTax: 0,
  totalTips: 0,
  totalDeliveryFees: 0,
  discounts: { totalDiscounts: 0, promoCodeDiscounts: 0, customerDiscounts: 0, fidelityPointsDiscounts: 0 },
  refunds: { refundCount: 0, totalRefundedAmount: 0 },
  cancelledOrdersCount: 0,
  cancelledOrdersTotal: 0,
  paymentsByMethod: [],
  salesByOrderType: [],
  salesByProductType: [],
  topSellingItems: [],
});

const dateInput = (): HTMLInputElement => document.querySelector('input[type="date"]') as HTMLInputElement;

describe('ZReportModal — whose calendar day the till closes on (#511)', () => {
  it("asks the RESTAURANT which day it is instead of naming the device's", async () => {
    // The restaurant's day here is deliberately not the device's on either clock: this is the
    // till on another timezone (a laptop on a VPN, a tablet whose zone was never set) — and, on a
    // correctly-set device in Geneva, it is also every closing between local midnight and 02:00,
    // where `new Date().toISOString()` still names YESTERDAY. Backend #372 fixed that window
    // server-side; sending an explicit date is what kept the fix out of reach.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));

    render(<ZReportModal isOpen onClose={jest.fn()} />);

    await waitFor(() => expect(mockGetZReport).toHaveBeenCalled());
    expect(mockGetZReport).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));
    expect(dateInput().value).not.toBe(deviceDay());
  });

  it("caps the picker at the restaurant's today, not the device's", async () => {
    // The ceiling used to be the device's UTC day, which east of UTC is a day BEHIND the tenant's
    // after local midnight — the picker would refuse the very day the cashier is closing.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));

    render(<ZReportModal isOpen onClose={jest.fn()} />);

    await waitFor(() => expect(dateInput().max).toBe(tenantDay));
  });

  it('sends a day the cashier NAMED, and shows what came back', async () => {
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    mockGetZReport.mockResolvedValue(reportFor('2026-03-01'));
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    await waitFor(() => expect(mockGetZReport).toHaveBeenLastCalledWith('2026-03-01'));
    await waitFor(() => expect(dateInput().value).toBe('2026-03-01'));
  });

  it("retries by asking for the restaurant's day when the first load never named one", async () => {
    // Nothing told us the day, so retry must omit the parameter again — not send an empty string,
    // which the server would refuse as a malformed date.
    mockGetZReport.mockRejectedValue(new ApiError(503, 'The till is not answering'));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await screen.findByText('The till is not answering');

    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    fireEvent.click(screen.getByText('cashier.zreport.retry'));

    await waitFor(() => expect(mockGetZReport).toHaveBeenLastCalledWith(undefined));
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));
  });

  it('opens once and stays on the day it was told, instead of refetching itself', async () => {
    // The open effect used to depend on `fetchReport`, whose identity follows `t`. With a `t`
    // that changes per render it re-ran forever, and every re-run re-asked for TODAY — so a
    // cashier who picked another day watched it revert.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    mockGetZReport.mockResolvedValue(reportFor('2026-03-01'));
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });
    await waitFor(() => expect(dateInput().value).toBe('2026-03-01'));

    // The loop was render-driven rather than timed, so it re-armed on every settled promise: a
    // handful of macrotask turns is what exposes it, not a long wall-clock wait (which is why this
    // is five flushes and not a `setTimeout(250)`).
    const callsAfterThePick = mockGetZReport.mock.calls.length;
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(mockGetZReport.mock.calls).toHaveLength(callsAfterThePick);
    expect(dateInput().value).toBe('2026-03-01');
  });

  it('keeps the ceiling at today when an older day is opened', async () => {
    // Only a DATELESS answer names today. Letting a named day rewrite the ceiling would lower it
    // to whatever the cashier looked at, and there would be no way back to today.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().max).toBe(tenantDay));

    mockGetZReport.mockResolvedValue(reportFor('2026-03-01', 41));
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    await screen.findByText('41');
    expect(dateInput().value).toBe('2026-03-01');
    expect(dateInput().max).toBe(tenantDay);
  });

  it("does not carry the last session's day into the next open", async () => {
    // Re-opening asks for today again, so the field must not sit on a day the incoming figures
    // are not for — the day and the numbers beside it would name different reports.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    const { rerender } = render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    mockGetZReport.mockResolvedValue(reportFor('2026-03-01'));
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });
    await waitFor(() => expect(dateInput().value).toBe('2026-03-01'));

    rerender(<ZReportModal isOpen={false} onClose={jest.fn()} />);
    // Never settles, so this pins the state DURING the reload rather than after it.
    mockGetZReport.mockReturnValue(new Promise(() => {}));
    rerender(<ZReportModal isOpen onClose={jest.fn()} />);

    expect(dateInput().value).toBe('');
  });

  it('holds the day it knows when the answer does not name one', async () => {
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    mockGetZReport.mockResolvedValue({ ...reportFor(tenantDay, 41), reportDate: 'not a date' });
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    // Blanking the field on an unreadable answer would leave figures on screen with no day beside
    // them at all, and blank the ceiling with it.
    await screen.findByText('41');
    expect(dateInput().value).toBe('2026-03-01');
    expect(dateInput().max).toBe(tenantDay);
  });

  it('ignores a half-typed or cleared date instead of asking for today', async () => {
    // `<input type="date">` reports '' mid-typing and on clear; an empty day means TODAY once the
    // query string drops it, and the answer would then overwrite what is being typed.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));
    const callsSoFar = mockGetZReport.mock.calls.length;

    fireEvent.change(dateInput(), { target: { value: '' } });

    expect(mockGetZReport.mock.calls).toHaveLength(callsSoFar);
    expect(dateInput().value).toBe(tenantDay);
  });

  it('will not let a day be picked before the restaurant has named today', async () => {
    // With the first load refused the ceiling is unknown, and an unbounded picker accepts a FUTURE
    // day — for which the server returns a well-formed all-zero report that reads like a real
    // close. Retry is the only move.
    mockGetZReport.mockRejectedValue(new ApiError(503, 'The till is not answering'));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await screen.findByText('The till is not answering');

    expect(dateInput().disabled).toBe(true);
    expect(dateInput().max).toBe('');
  });

  it('lets only the newest request write, whatever order the answers come back in', async () => {
    // Two days picked in quick succession over a venue's own wifi can answer out of order. The
    // loser used to land its figures AND rewrite the date field — a day beside takings that are
    // not its own, which is the one thing this component must never show.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    let settleFirst: (report: ZReportDto) => void = () => {};
    mockGetZReport.mockReturnValueOnce(
      new Promise<ZReportDto>((resolve) => {
        settleFirst = resolve;
      }),
    );
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    mockGetZReport.mockResolvedValueOnce(reportFor('2026-04-02', 41));
    fireEvent.change(dateInput(), { target: { value: '2026-04-02' } });
    await screen.findByText('41');

    // The abandoned day answers late.
    await act(async () => {
      settleFirst(reportFor('2026-03-01', 7));
      await Promise.resolve();
    });

    expect(dateInput().value).toBe('2026-04-02');
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });

  it('does not let a superseded failure erase the figures that did arrive', async () => {
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    let failFirst: (reason: Error) => void = () => {};
    mockGetZReport.mockReturnValueOnce(
      new Promise<ZReportDto>((_, reject) => {
        failFirst = reject;
      }),
    );
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    mockGetZReport.mockResolvedValueOnce(reportFor('2026-04-02', 41));
    fireEvent.change(dateInput(), { target: { value: '2026-04-02' } });
    await screen.findByText('41');

    await act(async () => {
      failFirst(new ApiError(500, 'The till gave up on the day you left'));
      await Promise.resolve();
    });

    expect(screen.queryByText('The till gave up on the day you left')).not.toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
  });

  it('keeps the spinner up when a superseded request finishes first', async () => {
    // The date field moves the moment a day is picked, but the body renders only when loading
    // stops — so a stale `finally` puts the PREVIOUS day's figures under the NEW day's date. The
    // spinner belongs to the request that is still in flight.
    const tenantDay = dayAfterTheDeviceDay();
    mockGetZReport.mockResolvedValue(reportFor(tenantDay));
    render(<ZReportModal isOpen onClose={jest.fn()} />);
    await waitFor(() => expect(dateInput().value).toBe(tenantDay));

    let settleFirst: (report: ZReportDto) => void = () => {};
    mockGetZReport.mockReturnValueOnce(
      new Promise<ZReportDto>((resolve) => {
        settleFirst = resolve;
      }),
    );
    fireEvent.change(dateInput(), { target: { value: '2026-03-01' } });

    // Never settles: the newest request is still in flight for the rest of this test.
    mockGetZReport.mockReturnValueOnce(new Promise<ZReportDto>(() => {}));
    fireEvent.change(dateInput(), { target: { value: '2026-04-02' } });
    expect(screen.getByText('cashier.zreport.loading')).toBeInTheDocument();

    await act(async () => {
      settleFirst(reportFor('2026-03-01', 7));
      await Promise.resolve();
    });

    expect(screen.getByText('cashier.zreport.loading')).toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});
