import { act, renderHook } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import { useCashierDialogs, type CashierMutations } from './useCashierDialogs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const order = { id: 'order-1', orderNumber: 'A-1', remainingAmount: 20 } as unknown as OrderDto;
const operation = { operationId: 'op-1', amount: 20, paymentMethod: 'Cash' };
const paymentData = {
  operationId: 'op-1',
  amount: 20,
  paymentMethod: 'Cash',
};

type PaymentReconciliationMutation = NonNullable<CashierMutations['reconcilePayment']>;
type TestMutations = {
  updateOrderStatus: jest.MockedFunction<CashierMutations['updateOrderStatus']>;
  addPayment: jest.MockedFunction<CashierMutations['addPayment']>;
  reconcilePayment: jest.MockedFunction<PaymentReconciliationMutation>;
  refundPayment: jest.MockedFunction<CashierMutations['refundPayment']>;
  cancelOrder: jest.MockedFunction<CashierMutations['cancelOrder']>;
  toggleFocusOrder: jest.MockedFunction<CashierMutations['toggleFocusOrder']>;
  refreshOrders: jest.MockedFunction<CashierMutations['refreshOrders']>;
};

function createMutations(): TestMutations {
  return {
    updateOrderStatus: jest.fn(),
    addPayment: jest.fn(),
    reconcilePayment: jest.fn(),
    refundPayment: jest.fn(),
    cancelOrder: jest.fn(),
    toggleFocusOrder: jest.fn(),
    refreshOrders: jest.fn().mockResolvedValue(true),
  };
}

function openPayment(mutations: TestMutations) {
  const rendered = renderHook(() => useCashierDialogs([order], mutations));
  act(() => {
    rendered.result.current.setSelectedOrderId(order.id);
    rendered.result.current.setShowPaymentModal(true);
  });
  return rendered;
}

function committedLookup(): PaymentOperationLookupDto {
  return {
    operationId: operation.operationId,
    status: 'Committed',
    payment: { ...operation, id: 'payment-1', orderId: order.id, status: 'Completed' } as never,
    order: { ...order, totalPaid: 20, remainingAmount: 0 } as unknown as OrderDto,
  };
}

function unknownLookup(): PaymentOperationLookupDto {
  return { operationId: operation.operationId, status: 'Unknown', payment: null, order: null };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useCashierDialogs payment reconciliation', () => {
  it('checks the same operation and closes only after a committed lookup', async () => {
    const mutations = createMutations();
    const authoritative = committedLookup();
    mutations.addPayment.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'));
    mutations.reconcilePayment.mockResolvedValueOnce(authoritative);
    const { result } = openPayment(mutations);

    await act(async () => {
      await result.current.handleAddPayment(paymentData);
    });

    expect(mutations.addPayment).toHaveBeenCalledTimes(1);
    expect(mutations.reconcilePayment).toHaveBeenCalledWith(order.id, operation.operationId);
    expect(result.current.showPaymentModal).toBe(false);
    expect(result.current.successMessage).toBe('cashier.payment_added');
  });

  it('does not issue a second POST while the first payment is unresolved', async () => {
    const mutations = createMutations();
    let resolveAdd: ((value: OrderDto) => void) | undefined;
    mutations.addPayment.mockImplementationOnce(() => new Promise((resolve) => (resolveAdd = resolve)));
    const { result } = openPayment(mutations);

    let first: Promise<void>;
    await act(async () => {
      first = result.current.handleAddPayment(paymentData);
      await result.current.handleAddPayment(paymentData);
    });
    expect(mutations.addPayment).toHaveBeenCalledTimes(1);
    resolveAdd?.({ ...order } as OrderDto);
    await act(async () => {
      await first!;
    });
  });

  it('retains the dialog and operation when the lookup is unknown, without posting again', async () => {
    const mutations = createMutations();
    mutations.addPayment.mockRejectedValueOnce(new ApiError(0, ''));
    mutations.reconcilePayment.mockResolvedValueOnce(unknownLookup());
    const { result } = openPayment(mutations);

    await act(async () => {
      await expect(result.current.handleAddPayment(paymentData)).rejects.toThrow('cashier.payment_result_unknown');
    });

    expect(mutations.addPayment).toHaveBeenCalledTimes(1);
    expect(mutations.reconcilePayment).toHaveBeenCalledTimes(1);
    expect(result.current.showPaymentModal).toBe(true);
    expect(result.current.isMutating).toBe(false);
    expect(result.current.isCheckingPayment).toBe(false);
  });

  it('retains the dialog with guidance when the lookup itself fails', async () => {
    const mutations = createMutations();
    mutations.addPayment.mockRejectedValueOnce(new ApiError(504, 'Gateway timeout'));
    mutations.reconcilePayment.mockRejectedValueOnce(new ApiError(503, 'Lookup unavailable'));
    const { result } = openPayment(mutations);

    await act(async () => {
      await expect(result.current.handleAddPayment(paymentData)).rejects.toThrow('cashier.payment_check_failed');
    });

    expect(mutations.addPayment).toHaveBeenCalledTimes(1);
    expect(mutations.reconcilePayment).toHaveBeenCalledTimes(1);
    expect(result.current.showPaymentModal).toBe(true);
  });

  it('does not reconcile a definitive 4xx refusal', async () => {
    const mutations = createMutations();
    const refusal = new ApiError(400, 'Payment refused');
    mutations.addPayment.mockRejectedValueOnce(refusal);
    const { result } = openPayment(mutations);

    await act(async () => {
      await expect(result.current.handleAddPayment(paymentData)).rejects.toBe(refusal);
    });

    expect(mutations.reconcilePayment).not.toHaveBeenCalled();
    expect(result.current.showPaymentModal).toBe(true);
    expect(result.current.isMutating).toBe(false);
  });

  it('reports checking while the lookup is pending and ignores its result after unmount', async () => {
    const mutations = createMutations();
    let resolveLookup: ((value: PaymentOperationLookupDto) => void) | undefined;
    mutations.addPayment.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'));
    mutations.reconcilePayment.mockImplementationOnce(() => new Promise((resolve) => (resolveLookup = resolve)));
    const rendered = openPayment(mutations);

    let pending: Promise<void>;
    await act(async () => {
      pending = rendered.result.current.handleAddPayment(paymentData);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(rendered.result.current.isCheckingPayment).toBe(true);

    rendered.unmount();
    resolveLookup?.(committedLookup());
    await pending!;
  });
});
