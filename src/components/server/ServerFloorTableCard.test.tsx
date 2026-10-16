import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import ServerFloorTableCard from './ServerFloorTableCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? name))
        : key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/components/TenantLink', () => ({
  __esModule: true,
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}));

const table = (overrides: Partial<ServerFloorTable> = {}): ServerFloorTable => ({
  tableId: 'table/11a',
  tableLabel: '11a',
  zoneId: 'zone-1',
  zoneName: 'Terrace',
  isActive: true,
  isOutdoor: true,
  maxGuests: 4,
  positionX: 1,
  positionY: 1,
  width: 1,
  height: 1,
  shape: 'round',
  rotation: 0,
  state: 'Open',
  activeRoundCount: 1,
  readyRoundCount: 1,
  session: {
    serviceSessionId: 'session-1',
    version: 4,
    openedAt: '2026-10-02T10:00:00Z',
    ageMinutes: 20,
    currency: 'CHF',
    total: 24,
    paid: 4,
    remaining: 20,
    activeRoundCount: 1,
    readyRoundCount: 1,
    canCollect: false,
    canClose: false,
    hasLegacyAmbiguity: false,
  },
  legacy: null,
  reservation: null,
  hasLegacyAmbiguity: false,
  permittedActions: [],
  ...overrides,
});

describe('ServerFloorTableCard', () => {
  it('opens an available table directly into ordering', () => {
    const onSelect = jest.fn();
    render(
      <ServerFloorTableCard
        table={table({ state: 'Available', session: null, permittedActions: ['StartTable'] })}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Table 11a: Add order' }));
    expect(onSelect).toHaveBeenCalledWith('table/11a');
  });
  it('names each table in its ordering target', () => {
    render(
      <>
        <ServerFloorTableCard
          table={table({ tableLabel: '7', state: 'Available', session: null, permittedActions: ['StartTable'] })}
        />
        <ServerFloorTableCard
          table={table({ tableLabel: '8', state: 'Available', session: null, permittedActions: ['StartTable'] })}
        />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Table 7: Add order' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Table 8: Add order' })).toBeEnabled();
  });
  it('blocks available ordering while stale', () => {
    const onSelect = jest.fn();
    render(
      <ServerFloorTableCard
        table={table({ state: 'Available', session: null, permittedActions: ['StartTable'] })}
        onSelect={onSelect}
        isStale
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add order/ }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add order/ })).toBeDisabled();
  });
  it.each(['Open', 'NeedsReset', 'Reserved', 'Ambiguous'] as const)(
    'keeps %s actions in table details with one primary destination',
    (state) => {
      render(
        <ServerFloorTableCard
          table={table({
            state,
            permittedActions: ['AddRound', 'ViewBill', 'OpenTasks', 'CollectPayment', 'CloseVisit', 'MarkTableReady'],
          })}
        />,
      );
      const card = screen.getByRole('article');
      expect(within(card).getAllByRole('link')).toHaveLength(1);
      expect(within(card).getByRole('link', { name: 'Table 11a: Open table details' })).toHaveAttribute(
        'href',
        '/server/tables/table%2F11a',
      );
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    },
  );
  it('keeps the details route available while stale without exposing mutation links', () => {
    render(<ServerFloorTableCard table={table({ permittedActions: ['CollectPayment', 'CloseVisit'] })} isStale />);
    expect(screen.getByRole('link', { name: /Open table details/ })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a',
    );
    expect(screen.queryByRole('link', { name: 'Review payment' })).not.toBeInTheDocument();
  });
  it('fails closed for an unknown table state', () => {
    render(
      <ServerFloorTableCard
        table={table({ state: 'FutureState' as ServerFloorTable['state'], permittedActions: ['CloseVisit'] })}
      />,
    );
    expect(screen.getByRole('button', { name: /Table details unavailable/ })).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
