import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import baseEnglish from '@/locales/en.json';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { TableContextProvider } from '@/contexts/TableContext';
import { getPublicTableGuestFeature } from '@/services/publicTableGuestFeatureService';
import { loadTableGuestLocale } from '@/services/tableGuestLocaleService';
import tableGuestEnglish from '@/locales/table-guest/en.json';
import ScanPage from './page';

const mockPushMenu = jest.fn();
let mockQrCode = 'validated-qr-payload';

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/scan',
  useSearchParams: () => new URLSearchParams(`qr=${mockQrCode}`),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: (props: { readonly href?: string; readonly children?: ReactNode; readonly [key: string]: unknown }) =>
      React.createElement('a', props, props.children),
  };
});
jest.mock('@/hooks/useTenantPublicNavigation', () => ({
  useTenantPublicNavigation: () => ({ pushMenu: mockPushMenu }),
}));
jest.mock('@/contexts/TableGuestRouteRuntimeLoader', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/services/publicTableGuestFeatureService', () => ({ getPublicTableGuestFeature: jest.fn() }));
jest.mock('@/services/tableGuestLocaleService', () => ({ loadTableGuestLocale: jest.fn() }));

describe('ScanPage with table visits enabled', () => {
  beforeEach(() => {
    mockQrCode = 'validated-qr-payload';
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.mocked(getPublicTableGuestFeature).mockReset();
    jest
      .mocked(loadTableGuestLocale)
      .mockReset()
      .mockImplementation(async (instance, language) => {
        instance.addResourceBundle(language ?? 'en', 'translation', tableGuestEnglish, true, true);
      });
    i18n.removeResourceBundle('en', 'translation');
    i18n.addResourceBundle('en', 'translation', baseEnglish, true, true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { isValid: true, tableId: 'table-id', tableNumber: '8', maxGuests: 6, isOutdoor: false },
      }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  function renderWithPublicFeature() {
    return render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <TableGuestVisitProvider>
            <TableContextProvider>
              <ScanPage />
            </TableContextProvider>
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );
  }

  it('validates the QR first, then requires the admission code instead of routing straight to the menu', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableContextProvider>
              <ScanPage />
            </TableContextProvider>
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByLabelText('Table visit code')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/Tables/validate-qr/validated-qr-payload'));
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('does not reuse an earlier valid QR after the route changes to an invalid code', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { isValid: true, tableId: 'table-a', tableNumber: 'A', maxGuests: 4, isOutdoor: false },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) } as Response);
    const renderScan = () => (
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableContextProvider>
              <ScanPage />
            </TableContextProvider>
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>
    );
    const view = render(renderScan());

    expect(await screen.findByLabelText('Table visit code')).toBeInTheDocument();
    mockQrCode = 'invalid-qr-payload';
    view.rerender(renderScan());

    expect(await screen.findByText('Invalid or expired QR code')).toBeInTheDocument();
    expect(screen.queryByLabelText('Table visit code')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/Tables/validate-qr/invalid-qr-payload'),
    );
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('cancels the legacy menu redirect if the guest leaves the scan page first', async () => {
    const view = render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: false }}>
          <TableGuestVisitProvider>
            <TableContextProvider>
              <ScanPage />
            </TableContextProvider>
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('QR Code Valid!')).toBeInTheDocument();
    expect(screen.getByText('Redirecting to menu...')).toBeInTheDocument();
    view.unmount();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));

    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('shows the translated invalid-QR message when the server rejects a QR payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    } as Response);

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: false }}>
          <TableGuestVisitProvider>
            <TableContextProvider>
              <ScanPage />
            </TableContextProvider>
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('Invalid or expired QR code')).toBeInTheDocument();
  });

  it('keeps a saved visit and unresolved round blocked after a confirmed-off retry', async () => {
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: false, enabled: false })
      .mockResolvedValueOnce({ available: true, enabled: false });
    const visit = JSON.stringify({
      serviceSessionId: 'session-1',
      participantToken: 'x'.repeat(32),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const pendingRound = JSON.stringify({
      serviceSessionId: 'session-1',
      operationId: 'operation-1',
      expectedAccountRevision: 1,
      expectedBasketFingerprint: 'a'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', visit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', pendingRound);

    renderWithPublicFeature();

    expect(await screen.findByText(/Ask staff to confirm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(visit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(pendingRound);
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    expect(mockPushMenu).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Ask staff to confirm/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    expect(mockPushMenu).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(visit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(pendingRound);
  });

  it('allows the confirmed-off legacy QR redirect when there is no saved guest state', async () => {
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: false, enabled: false })
      .mockResolvedValueOnce({ available: true, enabled: false });

    renderWithPublicFeature();

    expect(await screen.findByText(/Ask staff to confirm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByText('Redirecting to menu...')).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));

    expect(mockPushMenu).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBeNull();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
  });

  it('fails closed when storage cannot prove there is no saved guest state', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });
    const originalGetItem = Storage.prototype.getItem;
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key.startsWith('rumi_table_guest_')) throw new Error('storage unavailable');
      return originalGetItem.call(this, key);
    });

    renderWithPublicFeature();

    expect(await screen.findByText(/Ask staff to confirm/)).toBeInTheDocument();
    expect(screen.queryByText('Redirecting to menu...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('keeps the QR flow blocked when the feature is enabled but its locale bundle fails to load', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: true });
    jest.mocked(loadTableGuestLocale).mockRejectedValueOnce(new Error('locale chunk unavailable'));

    renderWithPublicFeature();

    expect(
      await screen.findByText('Ask staff to confirm the table QR code and current visit code.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry status check' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    expect(mockPushMenu).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry status check' }));
    expect(await screen.findByLabelText('Table visit code')).toBeInTheDocument();
    expect(mockPushMenu).not.toHaveBeenCalled();
  });

  it('does not offer the legacy menu from an invalid-QR branch while feature status is unavailable', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: false, enabled: false });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    } as Response);

    renderWithPublicFeature();

    expect(
      await screen.findByText('Ask staff to confirm the table QR code and current visit code.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry status check' })).toBeInTheDocument();
    expect(mockPushMenu).not.toHaveBeenCalled();
  });
});
