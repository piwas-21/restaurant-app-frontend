import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketplaceKitchenBoard from './MarketplaceKitchenBoard';
import { useMarketplaceKitchenOrders } from '@/hooks/useMarketplaceKitchenOrders';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/en/kitchen-staff' }));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'KitchenStaff' }, isLoading: false }),
}));
jest.mock('@/hooks/useMarketplaceKitchenOrders');
jest.mock('@/components/server/OrderCard', () => ({
  __esModule: true,
  default: ({ order }: { order: { externalOrder: { externalDisplayId: string } } }) => (
    <article>{order.externalOrder.externalDisplayId}</article>
  ),
}));

const mockKitchenOrders = jest.mocked(useMarketplaceKitchenOrders);

beforeEach(() => {
  jest.clearAllMocks();
  const accepted = marketplaceOrder();
  accepted.status = 'Confirmed';
  accepted.isKitchenReleased = true;
  accepted.externalOrder!.externalState = 'ACCEPTED';
  mockKitchenOrders.mockReturnValue({
    orders: [accepted],
    isLoading: false,
    error: null,
    isStale: false,
    refresh: jest.fn(),
  });
});

it('renders the real accepted marketplace feed and filters by preparation status', () => {
  render(<MarketplaceKitchenBoard />);

  expect(screen.getByRole('heading', { name: 'marketplaceStaff.kitchen_title' })).toBeInTheDocument();
  expect(screen.getByText('9116D')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /marketplaceStaff.status.Preparing/ }));
  expect(screen.queryByText('9116D')).not.toBeInTheDocument();
  expect(screen.getByText('marketplaceStaff.kitchen_filter_empty')).toBeInTheDocument();
});

it('provides a visible stale-feed warning with an explicit retry', () => {
  mockKitchenOrders.mockReturnValue({
    orders: [marketplaceOrder()],
    isLoading: false,
    error: 'network unavailable',
    isStale: true,
    refresh: jest.fn(),
  });
  render(<MarketplaceKitchenBoard />);

  expect(screen.getByRole('alert')).toHaveTextContent('marketplaceStaff.kitchen_stale');
  expect(screen.getByRole('button', { name: 'marketplaceStaff.retry' })).toBeInTheDocument();
});
