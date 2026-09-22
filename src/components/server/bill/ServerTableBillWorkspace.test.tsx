import { fireEvent, render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import { useServerTableBillActions } from '@/hooks/serverWorkspace/useServerTableBillActions';
import ServerTableBillWorkspace from './ServerTableBillWorkspace';

jest.mock('@/hooks/serverWorkspace/useServerTableBillActions');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${Object.values(options).join(',')}` : key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@/components/cashier/CashierTablePaymentForm', () => ({
  __esModule: true,
  default: () => <div data-testid="payment-form" />,
}));

const mockedActions = useServerTableBillActions as jest.MockedFunction<typeof useServerTableBillActions>;

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
    submitPayment: jest.fn(async () => undefined),
    closeSession,
    reconcilePendingOperation: jest.fn(async () => undefined),
    refresh,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
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

  it('shows Collect only when the backend permits tender entry', () => {
    const collectable = { ...session, canCollect: true, canRequestPaymentHandoff: false };
    mockState(collectable);
    render(<ServerTableBillWorkspace session={collectable} actionsBlocked={false} refreshWorkspace={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'server.bill.collect' }));
    expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'server.bill.send_to_cashier' })).not.toBeInTheDocument();
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
});
