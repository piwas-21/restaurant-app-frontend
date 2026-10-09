import { act, renderHook, waitFor } from '@testing-library/react';
import { addPaymentToOrder, getPaymentOperation } from '@/services/cashierService';
import type { OrderDto, OrderPaymentDto, PaymentOperationLookupDto } from '@/types/order';
import { persistPendingPayment, readAnyPendingPayment } from '@/lib/cashierPendingPayment';
import { useCashierSessionPendingTender } from './useCashierSessionPendingTender';

jest.mock('@/services/cashierService', () => ({
  addPaymentToOrder: jest.fn(),
  getPaymentOperation: jest.fn(),
}));

const mockLookup = getPaymentOperation as jest.MockedFunction<typeof getPaymentOperation>;
const mockAddPayment = addPaymentToOrder as jest.MockedFunction<typeof addPaymentToOrder>;
const sessionOrder = { id: 'order-round-2', orderNumber: 'R-2', remainingAmount: 12 } as unknown as OrderDto;

const lookup = (overrides: Partial<PaymentOperationLookupDto> = {}): PaymentOperationLookupDto => ({
  operationId: 'operation-1',
  status: 'Unknown',
  payment: null,
  order: null,
  ...overrides,
});

const committedLookup = (): PaymentOperationLookupDto => {
  const payment = {
    id: 'payment-1',
    orderId: sessionOrder.id,
    operationId: 'operation-1',
    paymentMethod: 'Cash',
    amount: 12,
    status: 'Completed',
  } as OrderPaymentDto;
  return lookup({ status: 'Committed', payment, order: sessionOrder });
};

beforeEach(() => {
  window.sessionStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => jest.restoreAllMocks());

describe('useCashierSessionPendingTender', () => {
  it('waits for visit orders, then reconciles the saved child without an originating-order selection', async () => {
    persistPendingPayment('order-round-2', {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
    });
    mockLookup.mockResolvedValueOnce(lookup({ order: sessionOrder }));

    const { result, rerender } = renderHook(({ orderIds }) => useCashierSessionPendingTender({ orderIds }), {
      initialProps: { orderIds: undefined as readonly string[] | undefined },
    });

    expect(result.current).toMatchObject({ status: 'checking', blocking: true });
    expect(mockLookup).not.toHaveBeenCalled();

    rerender({ orderIds: ['order-round-1', 'order-round-2'] });
    await waitFor(() => expect(result.current).toMatchObject({ status: 'pending', blocking: true }));

    expect(mockLookup).toHaveBeenCalledWith('order-round-2', 'operation-1');
    expect(result.current.descriptor).toMatchObject({ orderId: 'order-round-2', operationId: 'operation-1' });
    expect(readAnyPendingPayment().status).toBe('pending');
  });

  it('ignores a valid descriptor for an order outside this visit without clearing it', async () => {
    persistPendingPayment('other-order', {
      operationId: 'other-operation',
      paymentMethod: 'Card',
      amount: 20,
    });

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: ['order-round-1'] }));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'clear', blocking: false }));
    expect(mockLookup).not.toHaveBeenCalled();
    expect(readAnyPendingPayment()).toMatchObject({ status: 'pending', operation: { orderId: 'other-order' } });
  });

  it.each(['corrupt-json', 'unreadable-storage'] as const)(
    'blocks on %s journal data without attempting an unrelated lookup',
    async (failure) => {
      if (failure === 'corrupt-json') {
        window.sessionStorage.setItem('cashier.pending-payment', '{broken');
      } else {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage unavailable');
        });
      }

      const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [] }));

      await waitFor(() => expect(result.current).toMatchObject({ status: 'unavailable', blocking: true }));
      expect(result.current.error).toBe('cashier.payment_check_failed');
      expect(mockLookup).not.toHaveBeenCalled();
    },
  );

  it('keeps an Unknown operation blocking and Check retries the same GET identity only', async () => {
    persistPendingPayment(sessionOrder.id, {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
    });
    mockLookup.mockResolvedValueOnce(lookup({ order: sessionOrder })).mockResolvedValueOnce(lookup());

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [sessionOrder.id] }));
    await waitFor(() => expect(result.current).toMatchObject({ status: 'pending', blocking: true }));

    await act(async () => result.current.check());

    expect(mockLookup).toHaveBeenCalledTimes(2);
    expect(mockLookup).toHaveBeenNthCalledWith(1, sessionOrder.id, 'operation-1');
    expect(mockLookup).toHaveBeenNthCalledWith(2, sessionOrder.id, 'operation-1');
    expect(mockAddPayment).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ status: 'pending', blocking: true });
    expect(result.current.descriptor).toMatchObject({ orderId: sessionOrder.id, operationId: 'operation-1' });
    expect(readAnyPendingPayment()).toMatchObject({ status: 'pending', operation: { operationId: 'operation-1' } });
  });

  it('clears only after a fully matching committed readback', async () => {
    persistPendingPayment(sessionOrder.id, {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
    });
    mockLookup.mockResolvedValueOnce(committedLookup());

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [sessionOrder.id] }));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'settled', blocking: false }));
    expect(mockLookup).toHaveBeenCalledWith(sessionOrder.id, 'operation-1');
    expect(readAnyPendingPayment()).toEqual({ status: 'none' });
    expect(mockAddPayment).not.toHaveBeenCalled();
  });

  it('does not clear a committed response whose payment identity belongs to another order', async () => {
    persistPendingPayment(sessionOrder.id, {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
    });
    const wrongPayment = {
      id: 'payment-other',
      orderId: 'another-order',
      operationId: 'operation-1',
    } as OrderPaymentDto;
    mockLookup.mockResolvedValueOnce(lookup({ status: 'Committed', payment: wrongPayment, order: sessionOrder }));

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [sessionOrder.id] }));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'unavailable', blocking: true }));
    expect(readAnyPendingPayment()).toMatchObject({ status: 'pending', operation: { operationId: 'operation-1' } });
  });

  it('does not clear a committed response whose payment terms contradict the saved tender', async () => {
    persistPendingPayment(sessionOrder.id, {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
      tipMinor: 200,
    });
    const contradictoryPayment = {
      id: 'payment-1',
      orderId: sessionOrder.id,
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 11,
      tipMinor: 200,
      status: 'Completed',
    } as OrderPaymentDto;
    mockLookup.mockResolvedValueOnce(
      lookup({ status: 'Committed', payment: contradictoryPayment, order: sessionOrder }),
    );

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [sessionOrder.id] }));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'unavailable', blocking: true }));
    expect(readAnyPendingPayment()).toMatchObject({ status: 'pending', operation: { operationId: 'operation-1' } });
  });

  it('keeps the guard blocking when storage cannot clear a confirmed operation', async () => {
    persistPendingPayment(sessionOrder.id, {
      operationId: 'operation-1',
      paymentMethod: 'Cash',
      amount: 12,
    });
    mockLookup.mockResolvedValueOnce(committedLookup());
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });

    const { result } = renderHook(() => useCashierSessionPendingTender({ orderIds: [sessionOrder.id] }));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'unavailable', blocking: true }));
    expect(readAnyPendingPayment()).toMatchObject({ status: 'pending', operation: { operationId: 'operation-1' } });
  });
});
