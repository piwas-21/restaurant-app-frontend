import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import { addPaymentToOrder, getOrderById, getPaymentOperation } from '@/services/cashierService';
import { useCashierCollection } from './useCashierCollection';

jest.mock('@/services/cashierService', () => ({
  addPaymentToOrder: jest.fn(),
  getOrderById: jest.fn(),
  getPaymentOperation: jest.fn(),
}));

const baseOrder = (overrides: Partial<OrderDto> = {}): OrderDto =>
  ({
    id: 'order-1',
    orderNumber: '1042',
    total: 18.5,
    totalPaid: 0,
    remainingAmount: 18.5,
    isFullyPaid: false,
    status: 'Completed',
    paymentStatus: 'Pending',
    orderDate: '2026-09-13T10:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
    ...overrides,
  }) as OrderDto;

const payment: AddPaymentRequest = {
  operationId: 'operation-1',
  paymentMethod: 'Cash',
  amount: 18.5,
};

const committedLookup = (updated: OrderDto): PaymentOperationLookupDto =>
  ({
    operationId: payment.operationId,
    status: 'Committed',
    payment: {
      id: 'payment-1',
      orderId: updated.id,
      operationId: payment.operationId,
      paymentMethod: 'Cash',
      amount: payment.amount,
      paymentDate: '2026-09-13T10:01:00Z',
    },
    order: updated,
  }) as PaymentOperationLookupDto;

const mockedGetOrder = jest.mocked(getOrderById);
const mockedAddPayment = jest.mocked(addPaymentToOrder);
const mockedGetOperation = jest.mocked(getPaymentOperation);

describe('useCashierCollection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the selected order and applies a definitive payment response', async () => {
    const initial = baseOrder();
    const updated = baseOrder({ totalPaid: 18.5, remainingAmount: 0, isFullyPaid: true, paymentStatus: 'Paid' });
    mockedGetOrder.mockResolvedValue(initial);
    mockedAddPayment.mockResolvedValue(updated);
    const { result } = renderHook(() => useCashierCollection(initial.id));

    await waitFor(() => expect(result.current.order).toEqual(initial));
    await act(async () => expect(await result.current.submitPayment(payment)).toEqual(updated));

    expect(mockedAddPayment).toHaveBeenCalledWith(initial.id, payment);
    expect(mockedGetOperation).not.toHaveBeenCalled();
    expect(result.current.order).toEqual(updated);
    expect(result.current.isMutating).toBe(false);
  });

  it('reconciles a transport failure by operation id and never repeats the write', async () => {
    const initial = baseOrder();
    const updated = baseOrder({ totalPaid: 18.5, remainingAmount: 0, isFullyPaid: true, paymentStatus: 'Paid' });
    mockedGetOrder.mockResolvedValue(initial);
    mockedAddPayment.mockRejectedValue(new ApiError(503, ''));
    mockedGetOperation.mockResolvedValue(committedLookup(updated));
    const { result } = renderHook(() => useCashierCollection(initial.id));
    await waitFor(() => expect(result.current.order).toEqual(initial));

    await act(async () => expect(await result.current.submitPayment(payment)).toEqual(updated));

    expect(mockedAddPayment).toHaveBeenCalledTimes(1);
    expect(mockedGetOperation).toHaveBeenCalledWith(initial.id, payment.operationId);
    expect(result.current.order).toEqual(updated);
  });

  it('surfaces a definitive refusal without performing reconciliation', async () => {
    const initial = baseOrder();
    const refusal = new ApiError(400, 'payment rejected');
    mockedGetOrder.mockResolvedValue(initial);
    mockedAddPayment.mockRejectedValue(refusal);
    const { result } = renderHook(() => useCashierCollection(initial.id));
    await waitFor(() => expect(result.current.order).toEqual(initial));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.submitPayment(payment);
      } catch (reason: unknown) {
        caught = reason;
      }
    });

    expect(caught).toBe(refusal);
    expect(mockedGetOperation).not.toHaveBeenCalled();
    expect(result.current.error).toBe('payment rejected');
  });

  it('prevents browser dismissal while a payment write is unresolved', async () => {
    const initial = baseOrder();
    const updated = baseOrder({ totalPaid: 18.5, remainingAmount: 0, isFullyPaid: true, paymentStatus: 'Paid' });
    let resolvePayment!: (value: OrderDto) => void;
    mockedGetOrder.mockResolvedValue(initial);
    mockedAddPayment.mockReturnValue(new Promise<OrderDto>((resolve) => (resolvePayment = resolve)));
    const { result } = renderHook(() => useCashierCollection(initial.id));
    await waitFor(() => expect(result.current.order).toEqual(initial));

    act(() => {
      void result.current.submitPayment(payment);
    });
    await waitFor(() => expect(result.current.isMutating).toBe(true));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    await act(async () => resolvePayment(updated));
    await waitFor(() => expect(result.current.isMutating).toBe(false));
  });
});
