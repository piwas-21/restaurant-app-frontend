import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import TableGuestAdmissionForm from './TableGuestAdmissionForm';

jest.mock('@/services/tableGuestVisitService', () => ({
  isExpiredVisitError: jest.fn(() => false),
  isUnavailableVisitError: jest.fn(() => false),
  tableGuestVisitService: {
    joinTableGuestVisit: jest.fn(),
    getTableGuestAccount: jest.fn(),
    createTableGuestRound: jest.fn(),
  },
}));

describe('TableGuestAdmissionForm', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('joins using the validated QR identity and keeps returned credentials out of navigation', async () => {
    jest.mocked(tableGuestVisitService.joinTableGuestVisit).mockResolvedValue({
      serviceSessionId: 'visit-id',
      participantToken: 'a'.repeat(40),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const onJoined = jest.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAdmissionForm qrCodeData="qr-payload" tableLabel="8" onJoined={onJoined} />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    fireEvent.change(await screen.findByLabelText('Table visit code'), { target: { value: 'gh23456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join table' }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledTimes(1));
    expect(tableGuestVisitService.joinTableGuestVisit).toHaveBeenCalledWith('qr-payload', 'GH23456789');
    expect(window.location.href).not.toContain('visit-id');
    expect(window.location.href).not.toContain('a'.repeat(40));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toContain('visit-id');
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toContain('participantToken');
  });
});
