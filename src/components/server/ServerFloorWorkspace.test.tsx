import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ServerFloorWorkspace from './ServerFloorWorkspace';
import { useServerFloorSnapshot } from '@/hooks/serverWorkspace/useServerFloorSnapshot';
import type { ServerFloorSnapshot } from '@/types/serverWorkspace';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const copy = typeof fallback === 'string' ? fallback : key;
      const values = typeof fallback === 'object' ? fallback : options;
      return copy.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? `{{${name}}}`));
    },
    i18n: { language: 'en' },
  }),
}));
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/serverWorkspace/useServerFloorSnapshot');
jest.mock('@/components/floor-plan/FloorPlanScene', () => ({
  __esModule: true,
  default: ({
    document,
    onSelectTable,
    formatTableLabel,
  }: {
    document: { tables: Array<{ id: string }> };
    onSelectTable: (id: string) => void;
    formatTableLabel: (table: { id: string }) => string;
  }) => (
    <svg aria-label="Restaurant floor plan">
      {document.tables.map((table) => (
        <g
          key={table.id}
          role="button"
          tabIndex={0}
          data-table-id={table.id}
          aria-label={formatTableLabel(table)}
          onClick={() => onSelectTable(table.id)}
        />
      ))}
    </svg>
  ),
}));

const mockUseFloor = useServerFloorSnapshot as jest.MockedFunction<typeof useServerFloorSnapshot>;

const snapshot: ServerFloorSnapshot = {
  serverTime: '2026-09-21T10:00:00Z',
  tenantTime: '2026-09-21T12:00:00+02:00',
  nextStateChangeAt: null,
  version: 'floor-v1',
  cursor: 'floor-v1',
  zones: [
    {
      id: 'zone-1',
      name: 'Main room',
      widthMeters: 10,
      heightMeters: 7,
      gridSizeCm: 25,
      backgroundStyle: 'plain',
      isDefault: true,
      displayOrder: 0,
      walls: [],
      items: [],
      tables: [],
    },
    {
      id: 'zone-2',
      name: 'Terrace',
      widthMeters: 8,
      heightMeters: 5,
      gridSizeCm: 25,
      backgroundStyle: 'plain',
      isDefault: false,
      displayOrder: 1,
      walls: [],
      items: [],
      tables: [],
    },
  ],
  tables: [
    {
      tableId: 'table-1',
      tableLabel: '1',
      zoneId: 'zone-1',
      zoneName: 'Main room',
      isActive: true,
      isOutdoor: false,
      maxGuests: 4,
      positionX: 2,
      positionY: 2,
      width: 1,
      height: 1,
      shape: 'round',
      rotation: 0,
      state: 'Open',
      activeRoundCount: 2,
      readyRoundCount: 1,
      session: {
        serviceSessionId: 'session-1',
        version: 2,
        openedAt: '2026-09-21T09:00:00Z',
        ageMinutes: 60,
        currency: 'CHF',
        total: 30,
        paid: 10,
        remaining: 20,
        activeRoundCount: 2,
        readyRoundCount: 1,
        canCollect: true,
        canClose: false,
        hasLegacyAmbiguity: false,
      },
      reservation: null,
      legacy: null,
      hasLegacyAmbiguity: false,
      permittedActions: ['AddRound', 'ViewBill'],
    },
    {
      tableId: 'table-2',
      tableLabel: '2',
      zoneId: 'zone-2',
      zoneName: 'Terrace',
      isActive: true,
      isOutdoor: true,
      maxGuests: 2,
      positionX: 2,
      positionY: 2,
      width: 1,
      height: 1,
      shape: 'square',
      rotation: 0,
      state: 'Available',
      activeRoundCount: 0,
      readyRoundCount: 0,
      reservation: null,
      legacy: null,
      hasLegacyAmbiguity: false,
      permittedActions: ['StartTable'],
    },
  ],
};

beforeEach(() => {
  window.sessionStorage.clear();
  mockPush.mockClear();
  mockUseFloor.mockReturnValue({
    snapshot,
    isLoading: false,
    isStale: false,
    error: null,
    connectionState: 'connected',
    refresh: jest.fn(async () => undefined),
  });
});

describe('ServerFloorWorkspace', () => {
  it('exposes an accessible spatial map and authoritative selected table card', () => {
    render(<ServerFloorWorkspace />);

    expect(screen.getByTestId('server-floor-workspace')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Main room' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Terrace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Table 1/ }));

    expect(screen.getByRole('link', { name: 'Open table details' })).toHaveAttribute('href', '/server/tables/table-1');
    expect(screen.getByText('CHF 20.00')).toBeInTheDocument();
    expect(screen.getByText('Add round')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Everywhere' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'Table state legend' })).toBeInTheDocument();
  });

  it('routes a narrow-screen map selection directly to the table shell', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: true,
        media: '(max-width: 1023px)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });

    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Table 1/ }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/server/tables/table-1'));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('switches to a complete list and filters by zone without losing route identities', () => {
    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getAllByRole('link', { name: 'Open table details' })[0]).toHaveAttribute(
      'href',
      '/server/tables/table-1',
    );
    expect(screen.getAllByRole('link', { name: 'Open table details' })[1]).toHaveAttribute(
      'href',
      '/server/tables/table-2',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Terrace' }));
    expect(screen.getAllByRole('link', { name: 'Open table details' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Open table details' })).toHaveAttribute('href', '/server/tables/table-2');
  });

  it('clears a selected table when its zone is no longer visible', () => {
    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Table 1/ }));
    expect(screen.getByText('CHF 20.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Terrace' }));

    expect(screen.queryByText('CHF 20.00')).not.toBeInTheDocument();
  });

  it('shows an explicit retry state when no confirmed snapshot exists', () => {
    mockUseFloor.mockReturnValue({
      snapshot: null,
      isLoading: false,
      isStale: false,
      error: 'floor_plan_load_error',
      connectionState: 'offline',
      refresh: jest.fn(async () => undefined),
    });

    render(<ServerFloorWorkspace />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps legacy outstanding balance visible while flagging the table for review', () => {
    mockUseFloor.mockReturnValue({
      snapshot: {
        ...snapshot,
        tables: [
          {
            ...snapshot.tables[0],
            state: 'Ambiguous',
            session: null,
            legacy: { orderCount: 1, activeOrderCount: 1, readyOrderCount: 0, outstanding: 18.5 },
            permittedActions: ['ReviewLegacy'],
          },
        ],
      },
      isLoading: false,
      isStale: false,
      error: null,
      connectionState: 'connected',
      refresh: jest.fn(async () => undefined),
    });

    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Table 1/ }));

    expect(screen.getByText('CHF 18.50')).toBeInTheDocument();
    expect(screen.getByText('Review legacy orders')).toBeInTheDocument();
  });

  it('announces an empty spatial zone instead of rendering a blank canvas', () => {
    mockUseFloor.mockReturnValue({
      snapshot: { ...snapshot, tables: [snapshot.tables[1]] },
      isLoading: false,
      isStale: false,
      error: null,
      connectionState: 'connected',
      refresh: jest.fn(async () => undefined),
    });

    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'Main room' }));

    expect(screen.getByText('No tables in this area right now.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Restaurant floor plan')).not.toBeInTheDocument();
  });

  it('fails closed for an unknown backend table state', () => {
    mockUseFloor.mockReturnValue({
      snapshot: {
        ...snapshot,
        tables: [{ ...snapshot.tables[0], state: 'FutureState' }, snapshot.tables[1]],
      },
      isLoading: false,
      isStale: false,
      error: null,
      connectionState: 'connected',
      refresh: jest.fn(async () => undefined),
    });

    render(<ServerFloorWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.getByText('Table details unavailable')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByRole('link', { name: 'Open table details' })).toHaveLength(1);
  });
});
