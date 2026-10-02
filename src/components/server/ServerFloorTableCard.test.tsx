import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import ServerFloorTableCard from './ServerFloorTableCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
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

describe('ServerFloorTableCard actions', () => {
  it('routes advertised actions to existing guarded table, bill, and task pages', () => {
    render(
      <ServerFloorTableCard
        table={table({
          permittedActions: [
            'AddRound',
            'ViewBill',
            'OpenTasks',
            'CollectPayment',
            'RequestPaymentHandoff',
            'CloseVisit',
            'ReviewLegacy',
          ],
        })}
      />,
    );

    const card = screen.getByRole('article');
    const actions = within(card).getByRole('list', { name: 'Table actions' });
    expect(within(actions).getByRole('link', { name: 'Add round' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a',
    );
    expect(within(actions).getByRole('link', { name: 'View account' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a#server-table-bill-actions',
    );
    expect(within(actions).getByRole('link', { name: 'Service tasks' })).toHaveAttribute('href', '/server/tasks');
    expect(within(actions).getByRole('link', { name: 'Review payment' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a#server-table-bill-actions',
    );
    expect(within(actions).getByRole('link', { name: 'Review cashier handoff' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a#server-table-bill-actions',
    );
    expect(within(actions).getByRole('link', { name: 'Review visit closure' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a#server-table-bill-actions',
    );
    expect(within(actions).getByRole('link', { name: 'Review legacy orders' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a',
    );
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers cashier handoff without exposing collection to a Server capability', () => {
    render(<ServerFloorTableCard table={table({ permittedActions: ['RequestPaymentHandoff'] })} />);

    expect(screen.getByRole('link', { name: 'Review cashier handoff' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a#server-table-bill-actions',
    );
    expect(screen.queryByRole('link', { name: 'Review payment' })).not.toBeInTheDocument();
  });

  it('hides permission links from stale floor data and keeps the safe details route', () => {
    render(<ServerFloorTableCard table={table({ permittedActions: ['CollectPayment', 'CloseVisit'] })} isStale />);

    expect(screen.getByRole('link', { name: 'Open table details' })).toHaveAttribute(
      'href',
      '/server/tables/table%2F11a',
    );
    expect(
      within(screen.getByRole('article')).getByText(
        'Table actions may be out of date. Open table details to check current options.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Table actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review visit closure' })).not.toBeInTheDocument();
  });

  it('explains unsupported capability routes without rendering their backend token', () => {
    render(<ServerFloorTableCard table={table({ permittedActions: ['FutureAction'] })} />);

    expect(
      within(screen.getByRole('article')).getByText(
        /This action has no supported link from the floor in this version\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('FutureAction')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'FutureAction' })).not.toBeInTheDocument();
  });

  it('fails closed when the backend adds an unknown table state', () => {
    render(
      <ServerFloorTableCard
        table={table({ state: 'FutureState' as ServerFloorTable['state'], permittedActions: ['CloseVisit'] })}
      />,
    );

    expect(screen.getByText('Table details unavailable')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Review visit closure' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Close visit' })).not.toBeInTheDocument();
  });
});
