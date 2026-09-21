import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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

describe('/server takeaway entry', () => {
  it('exposes an accessible route action without changing the table workspace', () => {
    render(<ServerPage />);

    expect(screen.getByTestId('table-grid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'server.takeaway.link' })).toHaveAttribute('href', '/server/takeaway');
  });
});
