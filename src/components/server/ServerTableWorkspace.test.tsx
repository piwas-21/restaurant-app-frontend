import { fireEvent, render, screen } from '@testing-library/react';
import type { TableServiceSessionDto } from '@/types/order';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import ServerTableWorkspace from './ServerTableWorkspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'server.open_table': 'Open Table',
        'cashier.tables.bill': 'Full table bill',
        'cashier.tables.add_round': 'Add round',
        'cashier.tables.reserved_table': 'This table has an active reservation.',
        'cashier.tables.currency_unknown': 'Currency unavailable',
        'server.status_stale': 'Stale data',
        'server.last_confirmed': 'Last confirmed',
      };
      const copy = labels[key] ?? (typeof fallback === 'string' ? fallback : key);
      const values = typeof fallback === 'object' ? fallback : options;
      return copy.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? `{{${name}}}`));
    },
    i18n: { language: 'en' },
  }),
}));

const table = (overrides: Partial<ServerFloorTable> = {}): ServerFloorTable => ({
  tableId: 'table-1',
  tableLabel: '1',
  zoneId: 'zone-1',
  zoneName: 'Main room',
  isActive: true,
  isOutdoor: false,
  maxGuests: 4,
  positionX: 1,
  positionY: 1,
  width: 1,
  height: 1,
  shape: 'round',
  rotation: 0,
  state: 'Available',
  activeRoundCount: 0,
  readyRoundCount: 0,
  reservation: null,
  legacy: null,
  hasLegacyAmbiguity: false,
  permittedActions: ['StartTable'],
  ...overrides,
});

const session: TableServiceSessionDto = {
  serviceSessionId: 'session-1',
  tableId: 'table-1',
  tableNumber: 1,
  tableLabel: '1',
  currency: 'CHF',
  status: 'Open',
  version: 2,
  openedAt: '2026-09-21T09:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 60,
  outstanding: 20,
  bill: {
    tableId: 'table-1',
    tableNumber: 1,
    tableLabel: '1',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 2,
    currency: 'CHF',
    generatedAt: '2026-09-21T10:00:00Z',
    rounds: [],
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
};

function state(overrides: Partial<ServerTableSessionState> = {}): ServerTableSessionState {
  return {
    table: table(),
    session: null,
    isLoading: false,
    isStarting: false,
    isStale: false,
    error: null,
    blocker: 'none',
    floorConnectionState: 'connected',
    floorLastConfirmed: '2026-09-21T10:00:00Z',
    refresh: jest.fn(async () => undefined),
    startTable: jest.fn(async () => session),
    canStartTable: true,
    canAddRound: false,
    ...overrides,
  };
}

describe('ServerTableWorkspace', () => {
  it('offers a 48px start action for an available table and leaves payment/close absent', () => {
    const current = state();
    render(<ServerTableWorkspace tableId="table-1" state={current} />);

    const start = screen.getByRole('button', { name: 'Open Table' });
    expect(start).toBeEnabled();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /payment|collect/i })).not.toBeInTheDocument();
    fireEvent.click(start);
    expect(current.startTable).toHaveBeenCalledTimes(1);
  });

  it('renders the explicit bill and routes Add round with stable table and session identities', () => {
    render(
      <ServerTableWorkspace
        tableId="table-1"
        state={state({
          table: table({ state: 'Open' }),
          session,
          canStartTable: false,
          canAddRound: true,
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Full table bill' })).toBeInTheDocument();
    expect(screen.getAllByText(/CHF.20\.00/)).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Add round' })).toHaveAttribute(
      'href',
      '/server/tables/table-1/order?serviceSessionId=session-1',
    );
  });

  it('blocks table actions when a task deep link points at an older service session', () => {
    render(
      <ServerTableWorkspace
        tableId="table-1"
        requestedSessionId="session-old"
        requestedOrderId="order-old"
        state={state({
          table: table({ state: 'Open' }),
          session,
          canStartTable: false,
          canAddRound: true,
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This task belongs to a different table visit.');
    expect(screen.getByRole('button', { name: 'Add round' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Add round' })).not.toBeInTheDocument();
  });

  it('disables start for reserved, stale, and unknown blockers', () => {
    const { rerender } = render(
      <ServerTableWorkspace
        tableId="table-1"
        state={state({
          table: table({
            state: 'Reserved',
            reservation: {
              reservationId: 'reservation-1',
              customerName: 'Mina Kaya',
              reservationDate: '2026-09-22',
              startTime: '19:00',
              endTime: '21:00',
              guestCount: 4,
              status: 'Confirmed',
              isCurrent: true,
            },
          }),
          blocker: 'reserved',
          canStartTable: false,
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open Table' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This table has an active reservation.');
    expect(screen.getByText('Mina Kaya')).toBeInTheDocument();
    expect(screen.getByText(/19:00/)).toBeInTheDocument();

    rerender(
      <ServerTableWorkspace
        tableId="table-1"
        state={state({ blocker: 'stale', isStale: true, canStartTable: false })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open Table' })).toBeDisabled();
    expect(screen.getByText(/Stale data/)).toBeInTheDocument();
  });

  it('uses canonical status copy and shows a failed start beside the available table', () => {
    const currencyless = {
      ...session,
      currency: null,
      bill: { ...session.bill, currency: null },
    };
    const { rerender } = render(
      <ServerTableWorkspace
        tableId="table-1"
        state={state({
          table: table({ state: 'Open' }),
          session: currencyless,
          canStartTable: false,
          canAddRound: true,
        })}
      />,
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getAllByText('Currency unavailable')).not.toHaveLength(0);

    rerender(
      <ServerTableWorkspace
        tableId="table-1"
        state={state({ error: 'Could not start this table.', canStartTable: true })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start this table.');
  });
});
