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

    await expect(refundPayment('order-1', 'payment-1', 18, 'Customer request')).resolves.toEqual(payment);

    expect(mockPost).toHaveBeenCalledWith(
      '/api/orders/order-1/payments/payment-1/refund',
      {
        orderId: 'order-1',
        paymentId: 'payment-1',
        refundAmount: 18,
        refundReason: 'Customer request',
      },
      { requireAuth: true },
    );
  });
});

describe('getCashierOrders — operational scope contract', () => {
  it('sends the operational scope, server filters, pagination and watermark', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { items: [], totalCount: 0 }, success: true });
    const modifiedSince = new Date('2026-03-08T10:00:00.000Z');

    await getCashierOrders({
      orderType: 'DineIn',
      search: '12',
      tableNumber: 12,
      page: 2,
      pageSize: 20,
      modifiedSince,
      tenantDay: '2026-03-08',
      startDate: new Date('2026-03-08T00:00:00.000Z'),
      endDate: new Date('2026-03-08T23:59:59.000Z'),
    });

    const [endpoint] = mockGet.mock.calls.at(-1) as [string];
    expect(endpoint).toBe(
      '/api/orders?scope=Operational&orderType=DineIn&search=12&tableNumber=12&page=2&pageSize=20&modifiedSince=2026-03-08T10%3A00%3A00.000Z',
    );
    expect(endpoint).not.toContain('tenantDay');
    expect(endpoint).not.toContain('startDate');
    expect(endpoint).not.toContain('endDate');
  });

  it('keeps date bounds only for an explicit all-orders read', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { items: [], totalCount: 0 }, success: true });

    await getCashierOrders({
      scope: 'All',
      tenantDay: '2026-03-08',
      startDate: new Date('2026-03-08T00:00:00.000Z'),
      endDate: new Date('2026-03-08T23:59:59.000Z'),
    });

    const [endpoint] = mockGet.mock.calls.at(-1) as [string];
    expect(endpoint).toContain('scope=All');
    expect(endpoint).toContain('tenantDay=2026-03-08');
    expect(endpoint).toContain('startDate=2026-03-08T00%3A00%3A00.000Z');
    expect(endpoint).toContain('endDate=2026-03-08T23%3A59%3A59.000Z');
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
