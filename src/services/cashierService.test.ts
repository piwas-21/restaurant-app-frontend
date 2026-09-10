import { apiClient } from '@/utils/apiClient';
import { refundPayment } from './cashierService';
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
