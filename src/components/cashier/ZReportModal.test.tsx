/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const reportFor = (day: string): ZReportDto => ({
  reportDate: `${day}T00:00:00Z`,
  generatedAt: new Date().toISOString(),
  totalTransactions: 0,
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

    const callsAfterThePick = mockGetZReport.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(mockGetZReport.mock.calls.length).toBe(callsAfterThePick);
    expect(dateInput().value).toBe('2026-03-01');
  });
});
