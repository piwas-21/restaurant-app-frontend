import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierHistoryWorkspace from './CashierHistoryWorkspace';

const mockFiltersHook = jest.fn();
const mockQueueHook = jest.fn();
const mockRouteHook = jest.fn();

jest.mock('@/hooks/cashier/useCashierHistoryFilters', () => ({
  useCashierHistoryFilters: () => mockFiltersHook(),
}));
jest.mock('@/hooks/cashier/useCashierHistoryOrders', () => ({
  useCashierHistoryOrders: (...args: unknown[]) => mockQueueHook(...args),
}));
jest.mock('@/hooks/cashier/useCashierOrderRoute', () => ({
  useCashierOrderRoute: () => mockRouteHook(),
}));
jest.mock('@/hooks/cashier/useCashierOrderSelection', () => ({
  useCashierOrderSelection: () => ({ order: null, isLoading: false, error: null }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('./CashierHistoryFilters', () => ({ __esModule: true, default: () => null }));
jest.mock('./CashierReadOnlyDestination', () => ({
  __esModule: true,
  default: ({ onRetry }: { readonly onRetry?: () => void }) => (
    <button type="button" data-testid="retry" onClick={onRetry} disabled={!onRetry}>
      Retry
    </button>
  ),
}));

const query = { scope: 'All' as const, page: 1, pageSize: 50 };
const queue = {
  orders: [],
  pagination: { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 },
  queueState: 'unavailable' as const,
  isLoading: false,
  error: 'history failed',
  refreshOrders: jest.fn(),
};
const callbacks = () => ({
  setRange: jest.fn(),
  setFromDay: jest.fn(),
  setToDay: jest.fn(),
  setSearchQuery: jest.fn(),
  submitSearch: jest.fn(),
  setStatusFilter: jest.fn(),
  setPaymentStatusFilter: jest.fn(),
  setOrderTypeFilter: jest.fn(),
  setPage: jest.fn(),
  refreshTenantDay: jest.fn(),
});

beforeEach(() => {
  mockFiltersHook.mockReset();
  mockQueueHook.mockReset();
  mockRouteHook.mockReset();
  queue.refreshOrders.mockReset();
  mockRouteHook.mockReturnValue({ selectedOrderId: null, navigateWithOrder: jest.fn(), clearOrder: jest.fn() });
  mockQueueHook.mockReturnValue(queue);
});

describe('CashierHistoryWorkspace retry routing', () => {
  it('retries a failed custom history request without refreshing tenant day', () => {
    const refreshTenantDay = jest.fn();
    mockFiltersHook.mockReturnValue({
      ...callbacks(),
      range: 'custom',
      rangeReady: true,
      fromDay: '2026-03-01',
      toDay: '2026-03-03',
      tenantTimeZone: 'Europe/Zurich',
      tenantDay: undefined,
      tenantDayLoading: false,
      tenantDayError: true,
      tenantDayErrorMessage: 'clock failed',
      searchQuery: '',
      statusFilter: 'all',
      paymentStatusFilter: 'all',
      orderTypeFilter: 'all',
      query,
      refreshTenantDay,
    });
    render(<CashierHistoryWorkspace />);

    fireEvent.click(screen.getByTestId('retry'));
    expect(queue.refreshOrders).toHaveBeenCalledTimes(1);
    expect(refreshTenantDay).not.toHaveBeenCalled();
  });

  it('does not expose retry while custom dates are incomplete', () => {
    const refreshTenantDay = jest.fn();
    mockFiltersHook.mockReturnValue({
      ...callbacks(),
      range: 'custom',
      rangeReady: false,
      fromDay: '2026-03-01',
      toDay: '',
      tenantTimeZone: undefined,
      tenantDay: undefined,
      tenantDayLoading: false,
      tenantDayError: true,
      tenantDayErrorMessage: 'clock failed',
      searchQuery: '',
      statusFilter: 'all',
      paymentStatusFilter: 'all',
      orderTypeFilter: 'all',
      query,
      refreshTenantDay,
    });
    render(<CashierHistoryWorkspace />);

    expect(screen.getByTestId('retry')).toBeDisabled();
    expect(refreshTenantDay).not.toHaveBeenCalled();
  });
});
