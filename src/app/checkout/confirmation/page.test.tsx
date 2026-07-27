import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ConfirmationPage from './page';
import { mixedKitchenBundleOrder } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
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

describe('ConfirmationPage — guest fallback (bug 2 hardening)', () => {
  beforeEach(() => {
    mockSearchParams.clear();
    jest.clearAllMocks();
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
});

/** How many times a name appears in the rendered page — the double-render guard. */
const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe('ConfirmationPage — bundle order over the root-only items contract (backend #237)', () => {
  beforeEach(() => {
    mockSearchParams.clear();
    jest.clearAllMocks();
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
