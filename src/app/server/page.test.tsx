import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import ServerPage from './page';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useServerOrders', () => ({
  useServerOrders: () => ({
    orders: [],
    tables: [],
    isConnected: true,
    isLoading: false,
    error: null,
    isStale: false,
    lastEventTime: null,
    connectionState: 'connected',
    updateOrderStatus: jest.fn(),
    getOrdersForTable: jest.fn(() => []),
    refreshOrders: jest.fn(),
    refreshTables: jest.fn(),
  }),
}));
jest.mock('@/components/server', () => ({
  ServerHeader: () => <header data-testid="server-header" />,
  TableGridView: () => <div data-testid="table-grid" />,
  ActiveOrdersPanel: () => <div data-testid="orders-panel" />,
  TableDetailsModal: () => null,
  TakeOrderModal: () => null,
}));
jest.mock('@/components/server/ServerFloorWorkspace', () => ({
  __esModule: true,
  default: () => <div data-testid="server-floor-v2" />,
}));

describe('/server takeaway entry', () => {
  it('exposes an accessible route action without changing the table workspace', () => {
    render(<ServerPage />);

    expect(screen.getByTestId('table-grid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'server.takeaway.link' })).toHaveAttribute('href', '/server/takeaway');
    expect(screen.getByRole('main')).toHaveAttribute('data-workspace-variant', 'v1');
  });

  it('selects the isolated V2 entry seam while keeping the safe V1 fallback', async () => {
    render(
      <TenantFeaturesProvider features={{ serverWorkspaceV2: true }}>
        <ServerPage />
      </TenantFeaturesProvider>,
    );

    expect(await screen.findByTestId('server-floor-v2')).toBeInTheDocument();
    expect(screen.queryByTestId('table-grid')).not.toBeInTheDocument();
  });
});
