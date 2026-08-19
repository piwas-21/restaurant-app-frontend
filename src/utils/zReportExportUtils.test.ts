/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { exportZReportToPDF } from './zReportExportUtils';
import { printHtmlContent } from './pdfExportUtils';
import { ZReportDto } from '@/types/order';
import { calendarDayFromReport } from './zReportDay';

jest.mock('./pdfExportUtils', () => ({ printHtmlContent: jest.fn() }));

const mockPrint = printHtmlContent as jest.Mock;

const report = (reportDate: string): ZReportDto => ({
  reportDate,
  generatedAt: '2026-08-19T04:30:00Z',
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

beforeEach(() => jest.clearAllMocks());

describe('the printed Z-report names the day the figures are for (#511)', () => {
  it('is deliberately printed on a device west of UTC', () => {
    // Without this premise the assertion below passes against the defect: on a UTC-clocked host
    // the local and UTC renderings of a midnight-UTC day are the same string.
    expect(new Date('2026-08-19T00:00:00Z').toLocaleDateString('de-CH')).toBe('18.8.2026');
  });

  it('prints the wire day in UTC, not in the device zone', () => {
    // `reportDate` is a calendar DAY at 00:00Z, so a device zone west of UTC used to put the
    // PREVIOUS day on the paper — a printed report whose header and figures name different days.
    exportZReportToPDF(report('2026-08-19T00:00:00Z'));

    const html = mockPrint.mock.calls[0][0] as string;
    expect(html).toContain('19. August 2026');
    expect(html).not.toContain('18. August 2026');
  });

  it('still prints the GENERATION time on the device clock', () => {
    // `generatedAt` is a real instant — "when this was run" is rightly read on the clock of
    // whoever ran it, and must not be dragged to UTC by the fix above.
    exportZReportToPDF(report('2026-08-19T00:00:00Z'));

    const html = mockPrint.mock.calls[0][0] as string;
    expect(html).toContain(new Date('2026-08-19T04:30:00Z').toLocaleString('de-CH'));
  });

  it('names the same day the screen does, for any shape the wire can carry', () => {
    // Two readers of one field agree only while the server keeps emitting `Z`. Given an offset
    // instead, an instant-converting formatter printed the 18th while the picker beside it showed
    // the 19th — this PR's own defect, one serialization change away.
    const wire = '2026-08-19T00:00:00+02:00';
    expect(calendarDayFromReport(wire)).toBe('2026-08-19');

    exportZReportToPDF(report(wire));

    const html = mockPrint.mock.calls[0][0] as string;
    expect(html).toContain('19. August 2026');
    expect(html).not.toContain('18. August 2026');
  });

  it('prints an unreadable day as it arrived rather than inventing one', () => {
    exportZReportToPDF(report('not a date'));

    const html = mockPrint.mock.calls[0][0] as string;
    expect(html).toContain('not a date');
  });
});
