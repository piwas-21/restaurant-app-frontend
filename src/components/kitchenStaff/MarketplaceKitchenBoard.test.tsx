import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketplaceKitchenBoard from './MarketplaceKitchenBoard';
import { useMarketplaceKitchenOrders } from '@/hooks/useMarketplaceKitchenOrders';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

let mockUserRole = 'KitchenStaff';
let mockAuthLoading = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/en/kitchen-staff' }));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: { role: mockUserRole }, isLoading: mockAuthLoading }),
}));
jest.mock('@/hooks/useMarketplaceKitchenOrders');

const mockKitchenOrders = jest.mocked(useMarketplaceKitchenOrders);

beforeEach(() => {
  jest.clearAllMocks();
  mockUserRole = 'KitchenStaff';
  mockAuthLoading = false;
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
  expect(screen.getByRole('group', { name: 'marketplaceStaff.kitchen_filter' })).toBeInTheDocument();
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

it('allows Server users on the Server audience route and shows permitted preparation actions', () => {
  mockUserRole = 'Server';
  const accepted = marketplaceOrder();
  accepted.status = 'Confirmed';
  accepted.isKitchenReleased = true;
  accepted.externalOrder!.externalState = 'ACCEPTED';
  accepted.permittedActions = [{ action: 'StartPreparing', allowed: true, requiresReason: false }];
  mockKitchenOrders.mockReturnValue({
    orders: [accepted],
    isLoading: false,
    error: null,
    isStale: false,
    refresh: jest.fn(),
  });

  render(<MarketplaceKitchenBoard audience="server" />);

  expect(screen.getByText('9116D')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'mark_as_preparing_button' })).toBeInTheDocument();
  expect(mockKitchenOrders).toHaveBeenCalledWith(true);
});

it('keeps Server users out of the KitchenStaff route', () => {
  mockUserRole = 'Server';

  render(<MarketplaceKitchenBoard />);

  expect(mockKitchenOrders).toHaveBeenCalledWith(false);
  expect(screen.getByText('loading')).toBeInTheDocument();
});

it('keeps non-Server roles out of the Server preparation route', () => {
  mockUserRole = 'Cashier';

  render(<MarketplaceKitchenBoard audience="server" />);

  expect(mockKitchenOrders).toHaveBeenCalledWith(false);
  expect(screen.getByText('loading')).toBeInTheDocument();
});

it('waits for role resolution before requesting the Server feed', () => {
  mockUserRole = 'Server';
  mockAuthLoading = true;

  render(<MarketplaceKitchenBoard audience="server" />);

  expect(mockKitchenOrders).toHaveBeenCalledWith(false);
  expect(screen.getByText('loading')).toBeInTheDocument();
});
