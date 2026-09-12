import { act, renderHook } from '@testing-library/react';
import { getPaymentOperation } from '@/services/cashierService';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import {
  classifyPaymentWriteError,
  isPaymentOutcomeUnknown,
  usePaymentReconciliation,
} from './usePaymentReconciliation';

jest.mock('@/services/cashierService', () => ({ getPaymentOperation: jest.fn() }));

const mockLookup = getPaymentOperation as jest.MockedFunction<typeof getPaymentOperation>;
const authoritativeOrder = { id: 'order-1', orderNumber: 'A-1', remainingAmount: 0 } as unknown as OrderDto;

const lookup = (overrides: Partial<PaymentOperationLookupDto> = {}): PaymentOperationLookupDto => ({
  operationId: 'op-1',
  status: 'Unknown',
  payment: null,
  order: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('payment write outcome classification', () => {
  it.each([
    ['network transport', new ApiError(0, '')],
    ['request timeout', new ApiError(408, 'Request Timeout')],
    ['rate limit', new ApiError(429, 'Too many requests')],
    ['server failure', new ApiError(503, 'Service unavailable')],
    ['fetch TypeError', new TypeError('Failed to fetch')],
  ])('marks %s as unknown', (_name, error) => {
    expect(classifyPaymentWriteError(error)).toBe('unknown');
    expect(isPaymentOutcomeUnknown(error)).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])('keeps definitive HTTP %s refusals as failures', (status) => {
    const error = new ApiError(status, 'Refused');
    expect(classifyPaymentWriteError(error)).toBe('definitive');
    expect(isPaymentOutcomeUnknown(error)).toBe(false);
  });
});

describe('usePaymentReconciliation', () => {
  it('returns a committed lookup with the authoritative order', async () => {
    mockLookup.mockResolvedValueOnce(
      lookup({
        status: 'Committed',
        payment: { id: 'payment-1', orderId: 'order-1', operationId: 'op-1' } as never,
        order: authoritativeOrder,
      }),
    );
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('order-1', 'op-1');
    });

    expect(mockLookup).toHaveBeenCalledWith('order-1', 'op-1');
    expect(reconciliation).toMatchObject({ status: 'Committed', order: authoritativeOrder });
    expect(result.current.isCheckingPayment).toBe(false);
  });

  it('returns unknown data without turning it into a failure', async () => {
    mockLookup.mockResolvedValueOnce(lookup({ order: authoritativeOrder }));
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('order-1', 'op-1');
    });

    expect(reconciliation).toMatchObject({ status: 'Unknown', order: authoritativeOrder });
    expect(mockLookup).toHaveBeenCalledTimes(1);
  });

  it('does not adopt a committed response for another order or operation', async () => {
    mockLookup.mockResolvedValueOnce(
      lookup({
        operationId: 'op-other',
        status: 'Committed',
        payment: { id: 'payment-other', orderId: 'order-other', operationId: 'op-other' } as never,
        order: { ...authoritativeOrder, id: 'order-other' },
      }),
    );
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('order-1', 'op-1');
    });

    expect(reconciliation).toEqual({ status: 'Unavailable' });
  });

  it('rejects committed data when the payment omits its operation identity', async () => {
    mockLookup.mockResolvedValueOnce(
      lookup({
        status: 'Committed',
        payment: { id: 'payment-1', orderId: 'order-1' } as never,
        order: authoritativeOrder,
      }),
    );
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('order-1', 'op-1');
    });

    expect(reconciliation).toEqual({ status: 'Unavailable' });
  });

  it('converts a lookup failure into unavailable without a second POST', async () => {
    mockLookup.mockRejectedValueOnce(new ApiError(503, 'Lookup unavailable'));
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let reconciliation;
    await act(async () => {
      reconciliation = await result.current.reconcilePayment('order-1', 'op-1');
    });

    expect(reconciliation).toMatchObject({ status: 'Unavailable' });
    expect(mockLookup).toHaveBeenCalledTimes(1);
  });

  it('marks the older lookup stale when a newer lookup wins the race', async () => {
    let resolveFirst: ((value: PaymentOperationLookupDto) => void) | undefined;
    let resolveSecond: ((value: PaymentOperationLookupDto) => void) | undefined;
    mockLookup
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let firstPromise: Promise<unknown>;
    let secondPromise: Promise<unknown>;
    await act(async () => {
      firstPromise = result.current.reconcilePayment('order-1', 'op-1');
      secondPromise = result.current.reconcilePayment('order-1', 'op-2');
    });
    await act(async () => {
      resolveFirst?.(lookup({ status: 'Committed', order: authoritativeOrder }));
      resolveSecond?.(
        lookup({
          status: 'Committed',
          operationId: 'op-2',
          payment: { id: 'payment-2', orderId: 'order-1', operationId: 'op-2' } as never,
          order: authoritativeOrder,
        }),
      );
      await Promise.all([firstPromise, secondPromise]);
    });

    await expect(firstPromise!).resolves.toEqual({ status: 'Stale' });
    await expect(secondPromise!).resolves.toMatchObject({ status: 'Committed' });
    expect(result.current.isCheckingPayment).toBe(false);
  });

  it('cancels an in-flight lookup without adopting its result', async () => {
    let resolveLookup: ((value: PaymentOperationLookupDto) => void) | undefined;
    mockLookup.mockImplementationOnce(() => new Promise((resolve) => (resolveLookup = resolve)));
    const { result } = renderHook(() => usePaymentReconciliation(mockLookup));

    let pending: Promise<unknown>;
    await act(async () => {
      pending = result.current.reconcilePayment('order-1', 'op-1');
    });
    act(() => result.current.cancelReconciliation());
    expect(result.current.isCheckingPayment).toBe(false);
    resolveLookup?.(
      lookup({
        status: 'Committed',
        payment: { id: 'payment-1', orderId: 'order-1', operationId: 'op-1' } as never,
        order: authoritativeOrder,
      }),
    );

    await expect(pending!).resolves.toEqual({ status: 'Stale' });
  });

  it('ignores a lookup result after unmount', async () => {
    let resolveLookup: ((value: PaymentOperationLookupDto) => void) | undefined;
    mockLookup.mockImplementationOnce(() => new Promise((resolve) => (resolveLookup = resolve)));
    const { result, unmount } = renderHook(() => usePaymentReconciliation(mockLookup));

    let pending: Promise<unknown>;
    await act(async () => {
      pending = result.current.reconcilePayment('order-1', 'op-1');
    });
    unmount();
    resolveLookup?.(lookup({ status: 'Committed', order: authoritativeOrder }));

    await expect(pending!).resolves.toEqual({ status: 'Stale' });
  });
});
