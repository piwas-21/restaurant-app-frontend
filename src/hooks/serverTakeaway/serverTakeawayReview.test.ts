import type { OrderDto } from '@/types/order';
import { createStaffCounterOrder, quoteStaffCounterOrder } from '@/services/staffCounterOrderService';
import type { OrderItem } from '@/components/catalog/orderItems';
import { reviewServerTakeaway } from './serverTakeawayReview';

jest.mock('@/services/staffCounterOrderService', () => ({
  createStaffCounterOrder: jest.fn(),
  quoteStaffCounterOrder: jest.fn(),
}));

const mockQuote = quoteStaffCounterOrder as jest.MockedFunction<typeof quoteStaffCounterOrder>;
const mockCreate = createStaffCounterOrder as jest.MockedFunction<typeof createStaffCounterOrder>;
const item: OrderItem = { product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 2.5 };
const quote = { id: 'quote-1', orderNumber: 'Q-1', total: 2.5 } as OrderDto;
const order = { id: 'order-1', orderNumber: 'T-1', total: 2.5 } as OrderDto;

beforeEach(() => {
  jest.clearAllMocks();
  mockQuote.mockResolvedValue(quote);
  mockCreate.mockResolvedValue(order);
});

describe('reviewServerTakeaway', () => {
  it('quotes before creating and reuses the persisted operation id', async () => {
    const calls: string[] = [];
    mockQuote.mockImplementation(async () => {
      calls.push('quote');
      return quote;
    });
    mockCreate.mockImplementation(async () => {
      calls.push('create');
      return order;
    });

    const result = await reviewServerTakeaway({ items: [item], notes: '', storedOperationId: 'op-recovered' });

    expect(calls).toEqual(['quote', 'create']);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Takeaway',
        paymentState: 'Unpaid',
        clientOperationId: 'op-recovered',
        releaseToKitchen: true,
      }),
    );
    expect(result).toMatchObject({ status: 'committed', operationId: 'op-recovered', quote, order });
  });

  it('does not create when the authoritative quote refuses the ticket', async () => {
    mockQuote.mockRejectedValue(new Error('product unavailable'));

    const result = await reviewServerTakeaway({ items: [item], notes: '' });

    expect(result.status).toBe('refused');
    expect(result.error).toBe('server.takeaway.review_failed');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
