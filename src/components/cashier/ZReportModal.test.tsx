import { render, screen } from '@testing-library/react';
import ZReportModal from './ZReportModal';
import { getZReport } from '@/services/orderService';
import { ApiError } from '@/utils/apiClient';

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
