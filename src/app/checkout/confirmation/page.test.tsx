import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ConfirmationPage from './page';

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

    await waitFor(() => expect(screen.getByText('Order Received')).toBeInTheDocument());
    expect(screen.getByText('ORD-123')).toBeInTheDocument();
    expect(screen.queryByText(/failed to load order/i)).not.toBeInTheDocument();
  });

  it('still shows the error state when there is no order number to fall back to', async () => {
    mockSearchParams.set('orderId', 'o1');
    mockGetOrderById.mockRejectedValue(new Error('500'));

    render(<ConfirmationPage />);

    await waitFor(() => expect(screen.getByText('Failed to load order details')).toBeInTheDocument());
  });
});
