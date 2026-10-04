import { render, screen } from '@testing-library/react';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import type { TableServiceSessionDto } from '@/types/order';
import { useCashierTables } from '@/hooks/cashier/useCashierTables';
import { useCashierTableRoute } from '@/hooks/cashier/useCashierTableRoute';
import { useCashierTableSession } from '@/hooks/cashier/useCashierTableSession';
import { useCashierTenantTimeZoneState } from '@/hooks/cashier/useCashierTenantTimeZone';
import CashierTablesWorkspace from './CashierTablesWorkspace';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/cashier/useCashierTables', () => ({ useCashierTables: jest.fn() }));
jest.mock('@/hooks/cashier/useCashierTableRoute', () => ({ useCashierTableRoute: jest.fn() }));
jest.mock('@/hooks/cashier/useCashierTableSession', () => ({ useCashierTableSession: jest.fn() }));
jest.mock('@/hooks/cashier/useCashierTenantTimeZone', () => ({ useCashierTenantTimeZoneState: jest.fn() }));
jest.mock('./CashierWorkspaceShell', () => ({
  __esModule: true,
  default: ({ children }: { children: import('react').ReactNode }) => children,
}));
jest.mock('./CashierTableMap', () => ({ __esModule: true, default: () => null }));
jest.mock('./CashierTableList', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/table-service/TableReadinessAction', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ tableId, canMarkReady, isStale }: { tableId: string; canMarkReady: boolean; isStale: boolean }) =>
      React.createElement('div', {
        'data-testid': 'readiness-action',
        'data-table-id': tableId,
        'data-can-mark-ready': String(canMarkReady),
        'data-stale': String(isStale),
      }),
  };
});
jest.mock('./CashierTableEmptyState', () => ({ __esModule: true, default: () => null }));
jest.mock('./CashierTableSessionPanel', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  let mountId = 0;
  return {
    __esModule: true,
    default: function MockCashierTableSessionPanel({
      session,
      isMutating,
      isStale,
      error,
    }: {
      session: TableServiceSessionDto;
      isMutating: boolean;
      isStale: boolean;
      error: string | null;
    }) {
      const [id] = React.useState(() => ++mountId);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'div',
          {
            'data-testid': 'cashier-session-panel',
            'data-session-id': session.serviceSessionId,
            'data-locked': String(isMutating),
            'data-stale': String(isStale),
          },
          `mount-${id}`,
        ),
        error ? React.createElement('p', { role: 'alert' }, error) : null,
      );
    },
  };
});

const firstVisit = '22222222-2222-4222-8222-222222222222';
const nextVisit = '33333333-3333-4333-8333-333333333333';
const staleNeedsResetEntry: CashierTableEntry = {
  table: {
    id: 'table-a',
    tableNumber: '7',
    maxGuests: 4,
    isActive: true,
    isOutdoor: false,
    positionX: 0,
    positionY: 0,
    readinessState: 'NeedsReset',
    readinessVersion: 8,
  },
  session: null,
  status: 'needs-reset',
};

function makeSession(serviceSessionId: string): TableServiceSessionDto {
  return {
    serviceSessionId,
    tableNumber: 7,
    status: 'Open',
    version: 1,
    openedAt: '2026-10-04T12:00:00Z',
    roundCount: 1,
    ageMinutes: 1,
    outstanding: 12,
    bill: { serviceSessionId, currency: 'CHF', accountItems: [], orders: [] },
  } as unknown as TableServiceSessionDto;
}

function sessionState(
  session: TableServiceSessionDto | null,
  isLoading: boolean,
  isStale = false,
  error: string | null = null,
): ReturnType<typeof useCashierTableSession> {
  return {
    session,
    isLoading,
    isMutating: false,
    isStale,
    error,
    pendingOperation: null,
    refresh: jest.fn(async () => undefined),
    submitPayment: jest.fn(async () => makeSession(firstVisit)),
    closeSession: jest.fn(async () => makeSession(firstVisit)),
    reconcilePendingOperation: jest.fn(async () => undefined),
  };
}

const tableState: ReturnType<typeof useCashierTables> = {
  entries: [],
  queueState: 'ready',
  isLoading: false,
  isMutating: false,
  error: null,
  refresh: jest.fn(async () => undefined),
  openSession: jest.fn(async () => makeSession(firstVisit)),
  repairLegacyOrders: jest.fn(async () => makeSession(firstVisit)),
  repairSuccess: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCashierTables).mockReturnValue(tableState);
  jest.mocked(useCashierTableRoute).mockReturnValue({
    selectedSessionId: firstVisit,
    selectedTableNumber: null,
    navigateToTable: jest.fn(),
    navigateToSession: jest.fn(),
    clearSelection: jest.fn(),
  });
  jest.mocked(useCashierTableSession).mockReturnValue(sessionState(makeSession(firstVisit), false));
  jest
    .mocked(useCashierTenantTimeZoneState)
    .mockReturnValue({ timeZone: 'Europe/Zurich', isLoading: false, hasError: false });
});

it('keeps an already loaded same-visit panel mounted and locked during session refresh', () => {
  const { rerender } = render(<CashierTablesWorkspace />);
  const firstPanel = screen.getByTestId('cashier-session-panel');
  const mountId = firstPanel.textContent;
  expect(firstPanel).toHaveAttribute('data-session-id', firstVisit);
  expect(firstPanel).toHaveAttribute('data-locked', 'false');

  jest.mocked(useCashierTableSession).mockReturnValue(sessionState(makeSession(firstVisit), true));
  rerender(<CashierTablesWorkspace />);

  const refreshingPanel = screen.getByTestId('cashier-session-panel');
  expect(refreshingPanel).toHaveAttribute('data-session-id', firstVisit);
  expect(refreshingPanel).toHaveAttribute('data-locked', 'true');
  expect(refreshingPanel).toHaveTextContent(mountId ?? '');
  expect(screen.getByText('cashier.tables.session_loading')).toBeInTheDocument();

  jest
    .mocked(useCashierTableSession)
    .mockReturnValue(sessionState(makeSession(firstVisit), false, true, 'cashier.tables.session_unavailable'));
  rerender(<CashierTablesWorkspace />);

  const stalePanel = screen.getByTestId('cashier-session-panel');
  expect(stalePanel).toHaveAttribute('data-stale', 'true');
  expect(stalePanel).toHaveTextContent(mountId ?? '');
  expect(screen.getByRole('alert')).toHaveTextContent('cashier.tables.session_unavailable');
});

it('does not render a previous visit panel while a different selected visit loads', () => {
  const { rerender } = render(<CashierTablesWorkspace />);
  expect(screen.getByTestId('cashier-session-panel')).toHaveAttribute('data-session-id', firstVisit);

  jest.mocked(useCashierTableRoute).mockReturnValue({
    selectedSessionId: nextVisit,
    selectedTableNumber: null,
    navigateToTable: jest.fn(),
    navigateToSession: jest.fn(),
    clearSelection: jest.fn(),
  });
  jest.mocked(useCashierTableSession).mockReturnValue(sessionState(makeSession(firstVisit), true));
  rerender(<CashierTablesWorkspace />);

  expect(screen.queryByTestId('cashier-session-panel')).not.toBeInTheDocument();
  expect(screen.getByText('cashier.tables.session_loading')).toBeInTheDocument();
});

it('does not expose a prior table readiness action while a different visit is unresolved', () => {
  jest.mocked(useCashierTables).mockReturnValue({ ...tableState, entries: [staleNeedsResetEntry] });
  const { rerender } = render(<CashierTablesWorkspace />);

  jest.mocked(useCashierTableRoute).mockReturnValue({
    selectedSessionId: nextVisit,
    selectedTableNumber: null,
    navigateToTable: jest.fn(),
    navigateToSession: jest.fn(),
    clearSelection: jest.fn(),
  });
  jest.mocked(useCashierTableSession).mockReturnValue(sessionState(makeSession(firstVisit), true));
  rerender(<CashierTablesWorkspace />);

  expect(screen.queryByTestId('cashier-session-panel')).not.toBeInTheDocument();
  expect(screen.queryByTestId('readiness-action')).not.toBeInTheDocument();
  expect(screen.getByText('cashier.tables.session_loading')).toBeInTheDocument();
});
