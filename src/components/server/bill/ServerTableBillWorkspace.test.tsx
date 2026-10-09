import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import { useServerTableBillActions } from '@/hooks/serverWorkspace/useServerTableBillActions';
import ServerTableBillWorkspace from './ServerTableBillWorkspace';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/en/server/tables/table-1',
}));

jest.mock('@/hooks/serverWorkspace/useServerTableBillActions');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${Object.values(options).join(',')}` : key,
    i18n: { language: 'en' },
  }),
}));
const mockedActions = useServerTableBillActions as jest.MockedFunction<typeof useServerTableBillActions>;
let mockAuthRole: string | null = 'Server';

jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: () => ({ user: mockAuthRole ? { role: mockAuthRole } : null }),
}));

jest.mock('./ServerAccountPaymentCollectionHost', () => ({
  __esModule: true,
  default: ({ canStartCollection, expanded }: { canStartCollection: boolean; expanded: boolean }) => (
    <output data-testid="server-account-payment-host">{`${String(canStartCollection)}:${String(expanded)}`}</output>
  ),
}));

const session: TableServiceSessionDto = {
  serviceSessionId: 'session-1',
  tableId: 'table-1',
  tableNumber: 1,
  tableLabel: 'T1',
  currency: 'EUR',
  status: 'Open',
  version: 3,
  openedAt: '2026-09-22T10:00:00Z',
  roundCount: 1,
  ageMinutes: 30,
  outstanding: 20,
  eligibleOutstanding: 20,
  canCollect: false,
  canRequestPaymentHandoff: true,
  canClose: false,
  bill: {
    tableId: 'table-1',
    tableNumber: 1,
    tableLabel: 'T1',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 3,
    currency: 'EUR',
    generatedAt: '2026-09-22T10:30:00Z',
    rounds: [],
    orders: [],
    orderCount: 1,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
};

const requestHandoff = jest.fn(async () => undefined);
const cancelHandoff = jest.fn(async () => undefined);
const closeSession = jest.fn(async () => undefined);
const refresh = jest.fn(async () => undefined);

function mockState(current: TableServiceSessionDto) {
  mockedActions.mockReturnValue({
    session: current,
    isLoading: false,
    isMutating: false,
    isStale: false,
    error: null,
    requestHandoff,
    cancelHandoff,
    closeSession,
    reconcilePendingOperation: jest.fn(async () => undefined),
    refresh,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthRole = 'Server';
  mockState(session);
});

describe('ServerTableBillWorkspace', () => {
  it('offers a real cashier handoff and keeps close disabled while balance remains', () => {
    render(<ServerTableBillWorkspace session={session} actionsBlocked={false} refreshWorkspace={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'server.bill.send_to_cashier' }));
    expect(requestHandoff).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'server.bill.close_visit' })).toBeDisabled();
    expect(screen.getByText('server.bill.close_blocked_balance')).toBeInTheDocument();
  });

  it('shows pending handoff truth and exposes an explicit cancellation remedy', () => {
    const pending = {
      ...session,
      canRequestPaymentHandoff: false,
      hasPendingPaymentHandoff: true,
      paymentHandoff: {
        handoffId: 'handoff-1',
        serviceSessionId: 'session-1',
        operationId: 'operation-1',
        tableNumber: 1,
        tableLabel: 'T1',
        expectedVersion: 2,
        requestedAmount: 20,
        requestedCurrency: 'EUR',
        status: 'Requested' as const,
        requestedAt: '2026-09-22T10:20:00Z',
      },
    };
    mockState(pending);
    render(<ServerTableBillWorkspace session={pending} actionsBlocked={false} refreshWorkspace={jest.fn()} />);

    expect(screen.getByText(/server.bill.handoff_pending/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'server.bill.cancel_handoff' }));
    expect(cancelHandoff).toHaveBeenCalledTimes(1);
    expect(screen.getByText('server.bill.close_blocked_handoff')).toBeInTheDocument();
  });

  it('routes opted-in Server collection to the shared visit page without expanding an inline form', () => {
    const collectable = { ...session, canCollect: true, canRequestPaymentHandoff: false };
    mockState(collectable);
    render(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: true, serverAccountCollectionV1: true }}>
        <ServerTableBillWorkspace session={collectable} actionsBlocked={false} refreshWorkspace={jest.fn()} />
      </TenantFeaturesProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'server.bill.collect' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith('/en/server/collection?serviceSessionId=session-1&tableId=table-1');
    expect(screen.getByTestId('server-account-payment-host')).toHaveTextContent('true:false');
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'server.bill.send_to_cashier' })).not.toBeInTheDocument();
  });

  it('keeps fresh collection absent while the Server opt-in is off but leaves the recovery host mounted', () => {
    const collectable = { ...session, canCollect: true };
    render(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: true, serverAccountCollectionV1: false }}>
        <ServerTableBillWorkspace session={collectable} actionsBlocked={false} refreshWorkspace={jest.fn()} />
      </TenantFeaturesProvider>,
    );

    expect(screen.queryByRole('button', { name: 'server.bill.collect' })).not.toBeInTheDocument();
    expect(screen.getByTestId('server-account-payment-host')).toHaveTextContent('false:false');
  });

  it('does not offer Server collection to a Cashier role even while the Server flags are enabled', () => {
    mockAuthRole = 'Cashier';
    const collectable = { ...session, canCollect: true, canRequestPaymentHandoff: false };
    render(
      <TenantFeaturesProvider features={{ tableAccountPaymentsV1: true, serverAccountCollectionV1: true }}>
        <ServerTableBillWorkspace session={collectable} actionsBlocked={false} refreshWorkspace={jest.fn()} />
      </TenantFeaturesProvider>,
    );

    expect(screen.queryByRole('button', { name: 'server.bill.collect' })).not.toBeInTheDocument();
    expect(screen.getByTestId('server-account-payment-host')).toHaveTextContent('false:false');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('labels browser printing honestly without claiming paper output', () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<ServerTableBillWorkspace session={session} actionsBlocked={false} refreshWorkspace={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.print_bill' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByText('server.bill.print_dialog_opened')).toBeInTheDocument();
    print.mockRestore();
  });

  it('offers an explicit authoritative bill refresh', () => {
    render(<ServerTableBillWorkspace session={session} actionsBlocked={false} refreshWorkspace={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows the account tabs only when the tenant presentation flag is enabled', () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true, tableAccountV1: true }}>
        <ServerTableBillWorkspace session={session} actionsBlocked={false} refreshWorkspace={jest.fn()} />
      </TenantFeaturesProvider>,
    );

    expect(screen.getByRole('heading', { name: 'cashier.tables.account' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'cashier.tables.account_items' })).toBeInTheDocument();
    const printBill = screen.getByTestId('cashier-table-print-bill');
    expect(printBill).toHaveClass('printBill');
    expect(within(printBill).getByRole('heading', { name: 'cashier.tables.bill' })).toBeInTheDocument();
  });
});
