import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import { getPublicTableGuestFeature } from '@/services/publicTableGuestFeatureService';
import { loadTableGuestLocale } from '@/services/tableGuestLocaleService';
import baseEnglish from '@/locales/en.json';
import tableGuestEnglish from '@/locales/table-guest/en.json';
import TableGuestAccountWorkspace from './TableGuestAccountWorkspace';

const mockReplace = jest.fn();
const mockClearOrderType = jest.fn();
const mockClearTableContext = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/table-account',
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: () => ({ clearOrderType: mockClearOrderType }) }));
jest.mock('@/contexts/TableContext', () => ({ useTableContext: () => ({ clearTableContext: mockClearTableContext }) }));
jest.mock('@/services/tableGuestVisitService', () => ({
  isExpiredVisitError: jest.fn(() => false),
  isUnavailableVisitError: jest.fn(() => false),
  tableGuestVisitService: {
    joinTableGuestVisit: jest.fn(),
    getTableGuestAccount: jest.fn(),
    createTableGuestRound: jest.fn(),
  },
}));
jest.mock('@/services/tableGuestLocaleService', () => ({ loadTableGuestLocale: jest.fn() }));
jest.mock('@/services/publicTableGuestFeatureService', () => ({ getPublicTableGuestFeature: jest.fn() }));

const visit = {
  serviceSessionId: 'visit-id',
  participantToken: 'x'.repeat(40),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe('TableGuestAccountWorkspace', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();
    mockReplace.mockClear();
    mockClearOrderType.mockClear();
    mockClearTableContext.mockClear();
    i18n.removeResourceBundle('en', 'translation');
    i18n.addResourceBundle('en', 'translation', baseEnglish);
    jest.mocked(loadTableGuestLocale).mockImplementation(async (instance, language) => {
      const locale = language?.split(/[-_]/, 1)[0] || 'en';
      instance.addResourceBundle(locale, 'translation', tableGuestEnglish, true, true);
    });
  });

  it('shows one shared account with collapsed kitchen batches and no payment action', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(visit));
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue({
      serviceSessionId: 'visit-id',
      tableLabel: '12',
      currency: 'CHF',
      accountRevision: 2,
      subTotal: 30,
      tax: 2.4,
      discount: 1,
      tip: 0,
      total: 31.4,
      totalPaid: 10,
      remaining: 21.4,
      credit: 0,
      orders: [
        {
          orderId: 'order-1',
          orderNumber: 'A-100',
          status: 'Preparing',
          paymentStatus: 'Pending',
          orderDate: '2026-10-03T12:00:00Z',
          total: 31.4,
          totalPaid: 10,
          remainingAmount: 21.4,
        },
      ],
      items: [
        {
          orderId: 'order-1',
          orderNumber: 'A-100',
          unitCount: 2,
          item: {
            itemId: 'line-1',
            productName: 'Soup',
            quantity: 2,
            unitPrice: 15,
            itemTotal: 30,
            ingredientCustomizations: [],
            sideItems: [],
          },
        },
      ],
    });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Table account' })).toBeInTheDocument();
    await waitFor(() => expect(tableGuestVisitService.getTableGuestAccount).toHaveBeenCalledWith(visit));
    expect(screen.getByText(/21\.40/)).toBeInTheDocument();
    expect(screen.getAllByText(/31\.40/)).toHaveLength(2);
    const batch = screen.getByText('Kitchen batch A-100').closest('details');
    expect(batch).not.toHaveAttribute('open');
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('requires explicit safe departure before clearing an ended visit', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_blocked_v1', 'ended');
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'This table visit has ended' })).toBeInTheDocument();
    const leave = screen.getByRole('button', { name: 'Clear visit and return to menu' });
    expect(leave).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have left this table/i }));
    expect(leave).toBeEnabled();
    fireEvent.click(leave);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/en/menu'));
    expect(mockClearOrderType).toHaveBeenCalledTimes(1);
    expect(mockClearTableContext).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();
  });

  it('retains a pending guest round and hides legacy menu navigation while the rollout is off', async () => {
    const rawVisit = JSON.stringify(visit);
    const rawAttempt = JSON.stringify({
      serviceSessionId: 'visit-id',
      operationId: 'lost-response-operation',
      expectedAccountRevision: 3,
      expectedBasketFingerprint: 'C'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Table account unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry status check' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear visit and return to menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I have left this table/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve pending round first' })).toBeDisabled();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(tableGuestVisitService.getTableGuestAccount).not.toHaveBeenCalled();
  });

  it('clears an unavailable visit only after explicit safe-departure confirmation when no round is pending', async () => {
    const rawVisit = JSON.stringify(visit);
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Table account unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry status check' })).toBeInTheDocument();
    const leave = screen.getByRole('button', { name: 'Clear visit and return to menu' });
    expect(leave).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have left this table/i }));
    expect(leave).toBeEnabled();
    fireEvent.click(leave);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/en/menu'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBeNull();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
    expect(mockClearOrderType).toHaveBeenCalledTimes(1);
    expect(mockClearTableContext).toHaveBeenCalledTimes(1);
  });

  it('keeps a pending operation when the stored visit data is malformed and blocks safe departure', async () => {
    const rawVisit = '{invalid';
    const rawAttempt = JSON.stringify({
      serviceSessionId: 'visit-id',
      operationId: 'lost-response-operation',
      expectedAccountRevision: 3,
      expectedBasketFingerprint: 'D'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    const leave = await screen.findByRole('button', { name: 'Resolve pending round first' });
    expect(leave).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have left this table/i }));
    expect(leave).toBeDisabled();
    fireEvent.click(leave);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockClearOrderType).not.toHaveBeenCalled();
    expect(mockClearTableContext).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Back to menu' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });

  it('keeps a pending lost-response visit read-only until an unavailable locale can be retried', async () => {
    const rawVisit = JSON.stringify(visit);
    const rawAttempt = JSON.stringify({
      serviceSessionId: 'visit-id',
      operationId: 'lost-response-operation',
      expectedAccountRevision: 3,
      expectedBasketFingerprint: 'C'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest.mocked(loadTableGuestLocale).mockRejectedValueOnce(new Error('temporary locale failure'));
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue({
      serviceSessionId: 'visit-id',
      tableLabel: '12',
      currency: 'CHF',
      accountRevision: 3,
      subTotal: 10,
      tax: 0,
      discount: 0,
      tip: 0,
      total: 10,
      totalPaid: 0,
      remaining: 10,
      credit: 0,
      orders: [],
      items: [],
    });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.queryByRole('button', { name: 'Clear visit and return to menu' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    fireEvent.click(retry);

    expect(await screen.findByRole('heading', { name: 'Table account' })).toBeInTheDocument();
    await waitFor(() => expect(tableGuestVisitService.getTableGuestAccount).toHaveBeenCalledWith(visit));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(mockClearOrderType).not.toHaveBeenCalled();
    expect(mockClearTableContext).not.toHaveBeenCalled();
    expect(tableGuestVisitService.createTableGuestRound).not.toHaveBeenCalled();
  });

  it('keeps a pending lost-response visit and exposes retry after public feature lookup fails', async () => {
    const rawVisit = JSON.stringify(visit);
    const rawAttempt = JSON.stringify({
      serviceSessionId: 'visit-id',
      operationId: 'public-read-operation',
      expectedAccountRevision: 4,
      expectedBasketFingerprint: 'D'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: false, enabled: false })
      .mockResolvedValueOnce({ available: true, enabled: true });
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue({
      serviceSessionId: 'visit-id',
      tableLabel: '12',
      currency: 'CHF',
      accountRevision: 4,
      subTotal: 0,
      tax: 0,
      discount: 0,
      tip: 0,
      total: 0,
      totalPaid: 0,
      remaining: 0,
      credit: 0,
      orders: [],
      items: [],
    });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <TableGuestVisitProvider>
            <TableGuestAccountWorkspace />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    const retry = await screen.findByRole('button', { name: 'Retry status check' });
    expect(screen.queryByRole('button', { name: 'Clear visit and return to menu' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    fireEvent.click(retry);

    expect(await screen.findByRole('heading', { name: 'Table account' })).toBeInTheDocument();
    await waitFor(() => expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(tableGuestVisitService.getTableGuestAccount).toHaveBeenCalledWith(visit));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(mockClearOrderType).not.toHaveBeenCalled();
    expect(mockClearTableContext).not.toHaveBeenCalled();
    expect(tableGuestVisitService.createTableGuestRound).not.toHaveBeenCalled();
  });
});
