import { apiClient } from '@/utils/apiClient';
import type { AddPaymentToOrderCommand, OrderDto, OrderPaymentDto, RefundPaymentCommand } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { addPaymentToOrder, refundPayment } from './orderPayments';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { post: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('order payment service contracts', () => {
  it('returns the OrderDto returned by POST add-payment', async () => {
    const command: AddPaymentToOrderCommand = {
      orderId: 'order-1',
      paymentMethod: PaymentMethod.Cash,
      amount: 18,
    };
    const order = { id: 'order-1', payments: [] } as unknown as OrderDto;
    mockPost.mockResolvedValue({ data: order });

    await expect(addPaymentToOrder('order-1', command)).resolves.toBe(order);
    expect(mockPost).toHaveBeenCalledWith('/api/Orders/order-1/payments', command, { requireAuth: true });
  });

  it('posts backend refund field names for the shared admin path', async () => {
    const command: RefundPaymentCommand = {
      refundAmount: 18,
      refundReason: 'Customer request',
    };
    const payment = { id: 'payment-1' } as unknown as OrderPaymentDto;
    mockPost.mockResolvedValue({ data: payment });

    await expect(refundPayment('order-1', 'payment-1', command)).resolves.toBe(payment);
    expect(mockPost).toHaveBeenCalledWith('/api/Orders/order-1/payments/payment-1/refund', command, {
      requireAuth: true,
    });
  });
});
