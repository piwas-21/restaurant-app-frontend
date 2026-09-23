import { OrderType } from '@/types/order';
import { ApiError } from '@/utils/apiClient';
import { quoteStaffCounterOrder, createStaffCounterOrder } from '@/services/staffCounterOrderService';
import { resolveDineInSession } from './newSaleSession';
import { reviewCounterSale } from './newSaleReview';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';

jest.mock('@/services/staffCounterOrderService', () => ({
  quoteStaffCounterOrder: jest.fn(),
  createStaffCounterOrder: jest.fn(),
}));
jest.mock('./newSaleSession', () => ({ resolveDineInSession: jest.fn() }));

const mockQuote = quoteStaffCounterOrder as jest.Mock;
const mockCreate = createStaffCounterOrder as jest.Mock;
const mockResolve = resolveDineInSession as jest.Mock;

const line: CashierNewSaleDraftLine = {
  product: { id: 'product-1', name: 'Espresso' },
  quantity: 1,
  unitPrice: 3.5,
  selectedIngredientIds: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reviewCounterSale — quote-before-create order of operations', () => {
  it('sends customer identity and the requested redemption in the quote and create payloads', async () => {
    mockQuote.mockResolvedValueOnce({ id: 'quote-1' });
    mockCreate.mockResolvedValueOnce({ id: 'order-1' });
    await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
      loyaltyEnabled: true,
      contact: {
        customerUserId: 'user-7',
        customerName: 'Ada Lovelace',
        customerEmail: 'ada@example.test',
        customerPhone: '+41220000000',
        pointsToRedeem: 40,
      },
    });

    const quoted = mockQuote.mock.calls[0][0];
    const created = mockCreate.mock.calls[0][0];
    expect(quoted).toMatchObject({
      customerUserId: 'user-7',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.test',
      customerPhone: '+41220000000',
      pointsToRedeem: 40,
    });
    expect(created).toMatchObject({ ...quoted, clientOperationId: expect.any(String), releaseToKitchen: true });
  });

  it('quotes first and only then creates, with an explicit kitchen release', async () => {
    const order = { id: 'order-1' };
    mockQuote.mockResolvedValueOnce(order);
    mockCreate.mockResolvedValueOnce(order);

    const outcome = await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
    });

    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockQuote.mock.invocationCallOrder[0]).toBeLessThan(mockCreate.mock.invocationCallOrder[0]);

    const command = mockCreate.mock.calls[0][0];
    expect(command.clientOperationId).toBeTruthy();
    expect(command.releaseToKitchen).toBe(true);
    expect(outcome).toEqual({
      status: 'committed',
      quote: order,
      operationId: command.clientOperationId,
      orderId: 'order-1',
    });
  });

  it('mints a fresh operation id when none is stored', async () => {
    mockQuote.mockResolvedValue({ id: 'q' });
    mockCreate.mockResolvedValue({ id: 'order-1' });

    await reviewCounterSale({ channel: OrderType.Takeaway, lines: [line], notes: '', tableNumber: '' });
    const first = mockCreate.mock.calls[0][0].clientOperationId;

    await reviewCounterSale({ channel: OrderType.Takeaway, lines: [line], notes: '', tableNumber: '' });
    const second = mockCreate.mock.calls[1][0].clientOperationId;
    expect(second).not.toBe(first);
  });

  it('replays the stored operation id for a retry of the SAME ticket', async () => {
    mockQuote.mockResolvedValue({ id: 'q' });
    mockCreate.mockResolvedValue({ id: 'order-1' });

    await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
      storedOperationId: 'op-1',
    });
    await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
      storedOperationId: 'op-1',
    });

    expect(mockCreate.mock.calls[0][0].clientOperationId).toBe('op-1');
    expect(mockCreate.mock.calls[1][0].clientOperationId).toBe('op-1');
  });
});

describe('reviewCounterSale — dine-in needs an open visit', () => {
  it('refuses an invalid table number before any server call', async () => {
    const outcome = await reviewCounterSale({
      channel: OrderType.DineIn,
      lines: [line],
      notes: '',
      tableNumber: 'abc',
    });

    expect(outcome.status).toBe('blocked');
    expect(outcome.error).toBe('cashier.new_sale.invalid_table');
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('refuses a table with no open visit before quoting', async () => {
    mockResolve.mockResolvedValueOnce(null);

    const outcome = await reviewCounterSale({
      channel: OrderType.DineIn,
      lines: [line],
      notes: '',
      tableNumber: '12',
    });

    expect(outcome.status).toBe('blocked');
    expect(outcome.error).toBe('cashier.new_sale.no_open_session');
    expect(mockResolve).toHaveBeenCalledWith(12);
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('carries the table number and its session id on the quoted and created payloads', async () => {
    mockResolve.mockResolvedValueOnce('session-9');
    mockQuote.mockResolvedValueOnce({ id: 'q' });
    mockCreate.mockResolvedValueOnce({ id: 'order-2' });

    const outcome = await reviewCounterSale({
      channel: OrderType.DineIn,
      lines: [line],
      notes: '',
      tableNumber: '12',
    });

    expect(outcome.status).toBe('committed');
    expect(mockQuote.mock.calls[0][0].serviceSessionId).toBe('session-9');
    expect(mockQuote.mock.calls[0][0].tableNumber).toBe(12);
    expect(mockCreate.mock.calls[0][0].serviceSessionId).toBe('session-9');
  });
});

describe('reviewCounterSale — server refusals', () => {
  it('surfaces a quote refusal and never creates', async () => {
    mockQuote.mockRejectedValueOnce(new ApiError(400, 'Product X is not available for this channel.'));

    const outcome = await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
    });

    expect(outcome.status).toBe('refused');
    expect(outcome.error).toBe('Product X is not available for this channel.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('surfaces a create refusal after a good quote and keeps the quote and operation id', async () => {
    const quote = { id: 'q', total: 3.5 };
    mockQuote.mockResolvedValueOnce(quote);
    mockCreate.mockRejectedValueOnce(new ApiError(409, 'The order changed. Review it and try again.'));

    const outcome = await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
      storedOperationId: 'op-7',
    });

    expect(outcome.status).toBe('refused');
    expect(outcome.quote).toEqual(quote);
    expect(outcome.operationId).toBe('op-7');
    expect(outcome.error).toBe('The order changed. Review it and try again.');
  });

  it('offers the fallback sentence when the failure carries no message', async () => {
    mockQuote.mockRejectedValueOnce(new TypeError('Network unavailable'));

    const outcome = await reviewCounterSale({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: '',
    });

    expect(outcome.error).toBe('cashier.new_sale.review_failed');
  });
});
