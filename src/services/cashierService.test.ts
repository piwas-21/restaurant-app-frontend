import { apiClient } from '@/utils/apiClient';
import { getCashierOrders, getCashierTenantDay, refundPayment } from './cashierService';
import { PaymentMethod, type OrderPaymentDto } from '@/types/order';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cashierService.refundPayment', () => {
  it('returns the payment record from the refund endpoint', async () => {
    const payment: OrderPaymentDto = {
      id: 'payment-1',
      orderId: 'order-1',
      paymentMethod: PaymentMethod.Cash,
      amount: 18,
      status: 'Refunded',
      isRefunded: true,
      refundedAmount: 18,
    };
    mockPost.mockResolvedValue({ success: true, data: payment });

    await expect(refundPayment('order-1', 'payment-1', 18)).resolves.toEqual(payment);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/orders/order-1/payments/payment-1/refund',
      { orderId: 'order-1', paymentId: 'payment-1', refundAmount: 18 },
      { requireAuth: true },
    );
  });
});

describe('getCashierOrders — tenant-day parameter (#545)', () => {
  it('sends tenantDay instead of device-computed instants', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { items: [], totalCount: 0 }, success: true });
    await getCashierOrders({ tenantDay: '2026-03-08', page: 1, pageSize: 50 });
    const calledWith = mockGet.mock.calls.at(-1);
    expect(calledWith[0]).toContain('tenantDay=2026-03-08');
    expect(calledWith[0]).not.toContain('startDate');
  });
});

describe('getCashierTenantDay', () => {
  it('returns only the server-named calendar day for the cashier filter', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { date: '2026-03-08', timeZone: 'Europe/Zurich' }, success: true });

    await expect(getCashierTenantDay()).resolves.toBe('2026-03-08');
    expect(mockGet).toHaveBeenCalledWith('/api/tenant/today', { requireAuth: true });
  });

  it('does not invent a date when the tenant response is malformed', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { date: 'not-a-day' }, success: true });

    await expect(getCashierTenantDay()).resolves.toBeUndefined();
  });
});
