import { apiClient } from '@/utils/apiClient';
import { createStaffCounterOrder, quoteStaffCounterOrder, releaseStaffCounterOrder } from './staffCounterOrderService';
import { OrderType, type OrderDto, type StaffCounterOrderRequest } from '@/types/order';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

const order = (overrides: Partial<OrderDto> = {}): OrderDto =>
  ({
    id: 'order-1',
    orderNumber: '1042',
    type: 'Takeaway',
    total: 18,
    totalPaid: 0,
    remainingAmount: 18,
    isFullyPaid: false,
    status: 'Pending',
    paymentStatus: 'Pending',
    isFocusOrder: false,
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    subTotal: 18,
    tax: 0,
    deliveryFee: 0,
    discount: 0,
    discountPercentage: 0,
    customerDiscountAmount: 0,
    tip: 0,
    orderDate: '2026-09-20T10:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
    currency: 'EUR',
    ...overrides,
  }) as OrderDto;

const REQUEST: StaffCounterOrderRequest = {
  type: OrderType.Takeaway,
  paymentState: 'Unpaid',
  items: [
    {
      productId: 'product-1',
      quantity: 2,
      unitPrice: 9,
      selectedIngredientIds: [],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('quoteStaffCounterOrder', () => {
  it('posts the shared request to the quote route with auth and returns the priced order', async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: order() });

    await expect(quoteStaffCounterOrder(REQUEST)).resolves.toEqual(order());

    expect(mockPost).toHaveBeenCalledWith('/api/staff/orders/quote', REQUEST, { requireAuth: true });
  });

  it('refuses a failure envelope instead of returning an absent order', async () => {
    mockPost.mockResolvedValueOnce({ success: false, message: 'A counter order must contain at least one item.' });

    await expect(quoteStaffCounterOrder(REQUEST)).rejects.toThrow('A counter order must contain at least one item.');
  });
});

describe('createStaffCounterOrder', () => {
  const command = { ...REQUEST, clientOperationId: '0d7f19c4-1', releaseToKitchen: true };

  it('posts the idempotent command to the create route with auth', async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: order() });

    await expect(createStaffCounterOrder(command)).resolves.toEqual(order());

    expect(mockPost).toHaveBeenCalledWith('/api/staff/orders', command, { requireAuth: true });
  });

  it('surfaces a server refusal without inventing an order id', async () => {
    mockPost.mockResolvedValueOnce({
      success: false,
      message: 'A dine-in staff order requires an open table service session.',
    });

    await expect(createStaffCounterOrder(command)).rejects.toThrow(
      'A dine-in staff order requires an open table service session.',
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe('releaseStaffCounterOrder', () => {
  it('posts the release command to the order-scoped route with auth', async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: order() });

    await expect(
      releaseStaffCounterOrder('order-1', { clientOperationId: 'op-9', expectedVersion: 3 }),
    ).resolves.toEqual(order());

    expect(mockPost).toHaveBeenCalledWith(
      '/api/staff/orders/order-1/release',
      { clientOperationId: 'op-9', expectedVersion: 3 },
      {
        requireAuth: true,
      },
    );
  });

  it('refuses a payload-mismatch replay instead of reporting success', async () => {
    mockPost.mockResolvedValueOnce({
      success: false,
      message: 'This release operation was already submitted with different details.',
    });

    await expect(
      releaseStaffCounterOrder('order-1', { clientOperationId: 'op-9', expectedVersion: 4 }),
    ).rejects.toThrow();
  });
});
