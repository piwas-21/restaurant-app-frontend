import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import ConfirmationPage from './page';
import { mixedKitchenBundleOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { defaultValue?: string; count?: number }) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      return (fallbackOrOptions?.defaultValue ?? key).replace('{{count}}', String(fallbackOrOptions?.count ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

const mockSearchParams = new Map<string, string>();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => mockSearchParams.get(key) ?? null }),
}));

const mockGetOrderById = jest.fn();
jest.mock('@/services/orderService', () => ({
  getOrderById: (...args: unknown[]) => mockGetOrderById(...args),
}));
jest.mock('@/services/adminTaxConfigurationService', () => ({
  adminTaxConfigurationService: { getActiveTaxConfiguration: jest.fn().mockResolvedValue(null) },
}));

const mockGetGuestOrderStatus = jest.fn();
jest.mock('@/services/order/orderQueries', () => ({
  getGuestOrderStatus: (...args: unknown[]) => mockGetGuestOrderStatus(...args),
}));
jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: {
    getPublicConfirmationConfigurations: jest
      .fn()
      .mockResolvedValue([{ orderType: 'Takeaway', confirmationFlow: 'acknowledge', reviewWindowMinutes: 2 }]),
  },
}));

describe('ConfirmationPage — guest fallback (bug 2 hardening)', () => {
  beforeEach(() => {
    mockSearchParams.clear();
    jest.clearAllMocks();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('renders a minimal confirmation (not the error page) when the fetch fails but the order number is known', async () => {
    mockSearchParams.set('orderId', 'o1');
    mockSearchParams.set('orderNumber', 'ORD-123');
    mockGetOrderById.mockRejectedValue(new Error('401 Unauthorized'));

    render(<ConfirmationPage />);

    expect(await screen.findByText('Order Received')).toBeInTheDocument();
    expect(screen.getByText('ORD-123')).toBeInTheDocument();
    expect(screen.queryByText(/failed to load order/i)).not.toBeInTheDocument();
  });

  it('still shows the error state when there is no order number to fall back to', async () => {
    mockSearchParams.set('orderId', 'o1');
    mockGetOrderById.mockRejectedValue(new Error('500'));

    render(<ConfirmationPage />);

    expect(await screen.findByText('Failed to load order details')).toBeInTheDocument();
  });

  it('renders the live under-review state for a guest token even when the full receipt is unauthorized', async () => {
    mockSearchParams.set('orderId', 'o1');
    mockSearchParams.set('orderNumber', 'ORD-123');
    window.location.hash = 't=read-token';
    mockGetOrderById.mockRejectedValue(new Error('401 Unauthorized'));
    let resolveStatus!: (value: {
      orderNumber: string;
      type: string;
      status: string;
      estimatedDeliveryTime: null;
      confirmationFlow: 'acknowledge';
      reviewWindowMinutes: number;
      reviewDeadlineUtc: string;
    }) => void;
    mockGetGuestOrderStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );

    render(<ConfirmationPage />);

    expect(await screen.findByText('Loading your order...')).toBeInTheDocument();
    expect(screen.queryByText('Order not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Order Received')).not.toBeInTheDocument();
    act(() => {
      resolveStatus({
        orderNumber: 'ORD-123',
        type: 'Takeaway',
        status: 'Pending',
        estimatedDeliveryTime: null,
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 2,
        reviewDeadlineUtc: '2026-09-20T12:02:00Z',
      });
    });
    expect(await screen.findByRole('heading', { name: 'We have received your order' })).toBeInTheDocument();
    expect(mockGetGuestOrderStatus).toHaveBeenCalledWith('o1', 'read-token');
    expect(screen.queryByText(/failed to load order/i)).not.toBeInTheDocument();
  });

  it.each([
    ['Confirmed', 'Your order is approved', 'order_status_confirmed'],
    ['Cancelled', 'The restaurant could not accept this order', 'order_status_cancelled'],
  ])('uses live %s status throughout an authenticated acknowledge receipt', async (status, heading, statusKey) => {
    mockSearchParams.set('orderId', 'o1');
    mockSearchParams.set('orderNumber', 'ORD-123');
    window.location.hash = 't=read-token';
    mockGetOrderById.mockResolvedValue({ ...mixedKitchenBundleOrder(), type: 'Takeaway', status: 'Pending' });
    mockGetGuestOrderStatus.mockResolvedValue({
      orderNumber: 'ORD-123',
      type: 'Takeaway',
      status,
      estimatedDeliveryTime: status === 'Confirmed' ? '2026-09-20T12:30:00Z' : null,
      confirmationFlow: 'acknowledge',
      reviewWindowMinutes: 2,
      reviewDeadlineUtc: '2026-09-20T12:02:00Z',
    });

    render(<ConfirmationPage />);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByText(statusKey)).toHaveLength(2);
    expect(screen.queryByText('order_status_pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated Preparation Time')).not.toBeInTheDocument();
  });
});

/** How many times a name appears in the rendered page — the double-render guard. */
const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe('ConfirmationPage — bundle order over the root-only items contract (backend #237)', () => {
  beforeEach(() => {
    mockSearchParams.clear();
    jest.clearAllMocks();
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('renders each bundle component exactly once, and counts lines rather than components', async () => {
    mockSearchParams.set('orderId', 'o1');
    mockGetOrderById.mockResolvedValue(mixedKitchenBundleOrder());

    const { container } = render(<ConfirmationPage />);

    expect(await screen.findByText('Burger Combo')).toBeInTheDocument();

    // Before #237 the components were BOTH top-level entries and nested under the parent, so
    // `OrderLineSummary` rendered them a second time. One occurrence each is the fix.
    const text = container.textContent ?? '';
    expect(occurrences(text, 'Beef Burger')).toBe(1);
    expect(occurrences(text, 'Fries')).toBe(1);

    // "Order Items (N)" now counts the single root line, not the line plus its two components.
    expect(screen.getByText(/Order Items \(1\)/)).toBeInTheDocument();
  });
});
