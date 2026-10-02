import { act, renderHook, waitFor } from '@testing-library/react';
import { getOrderById } from '@/services/cashierService';
import { useCashierOrderSelection } from './useCashierOrderSelection';
import type { OrderDto } from '@/types/order';

jest.mock('@/services/cashierService', () => ({ getOrderById: jest.fn() }));

const mockGetOrderById = jest.mocked(getOrderById);
const order = (id: string): OrderDto => ({ id, orderNumber: id, items: [], payments: [] }) as unknown as OrderDto;

describe('useCashierOrderSelection', () => {
  beforeEach(() => mockGetOrderById.mockReset());

  it('fetches a selected order even when filters hide it', async () => {
    mockGetOrderById.mockResolvedValue(order('hidden'));
    const { result } = renderHook(() => useCashierOrderSelection([], 'hidden'));

    await waitFor(() => expect(result.current.order?.id).toBe('hidden'));
    expect(mockGetOrderById).toHaveBeenCalledWith('hidden');
  });

  it('refreshes visible detail when queue payment or status data changes', async () => {
    const visible = {
      ...order('visible'),
      status: 'Preparing',
      paymentStatus: 'Pending',
      total: 18,
      totalPaid: 0,
      remainingAmount: 18,
      isFullyPaid: false,
    } as OrderDto;
    const detail = { ...visible, status: 'Ready', paymentStatus: 'Completed', totalPaid: 18, remainingAmount: 0 };
    mockGetOrderById.mockResolvedValueOnce(detail).mockResolvedValueOnce(detail);
    const { result, rerender } = renderHook(({ queued }) => useCashierOrderSelection([queued], 'visible'), {
      initialProps: { queued: visible },
    });

    await waitFor(() => expect(mockGetOrderById).toHaveBeenCalledTimes(1));
    const changed = { ...visible, status: 'Ready', paymentStatus: 'Completed', totalPaid: 18, remainingAmount: 0 };
    rerender({ queued: changed });
    await waitFor(() => expect(mockGetOrderById).toHaveBeenCalledTimes(2));
    expect(result.current.order).toEqual(detail);
  });

  it('keeps the selected snapshot mounted while a newer same-order version is loading', async () => {
    const visible = {
      ...order('visible'),
      version: 7,
      updatedAt: '2026-10-02T17:00:00Z',
      status: 'PendingApproval',
      paymentStatus: 'Pending',
      total: 18,
      totalPaid: 0,
      remainingAmount: 18,
      isFullyPaid: false,
    } as OrderDto;
    let resolveRefresh: (value: OrderDto) => void = () => undefined;
    mockGetOrderById.mockResolvedValueOnce(visible).mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ queued }) => useCashierOrderSelection([queued], 'visible'), {
      initialProps: { queued: visible },
    });
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));

    const newer = { ...visible, version: 8, updatedAt: '2026-10-02T17:01:00Z' };
    rerender({ queued: newer });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.isSnapshotFresh).toBe(false);
    expect(result.current.order?.id).toBe('visible');
    expect(result.current.order?.version).toBe(8);
    expect(mockGetOrderById).toHaveBeenCalledTimes(2);

    act(() => resolveRefresh(newer));
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.order?.version).toBe(8);
  });

  it('refreshes when review facts or permissions change even if the aggregate version does not', async () => {
    const visible = {
      ...order('visible'),
      version: 7,
      updatedAt: '2026-10-02T17:00:00Z',
      notes: 'No onions',
    } as OrderDto;
    let resolveRefresh: (value: OrderDto) => void = () => undefined;
    mockGetOrderById.mockResolvedValueOnce(visible).mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ queued }) => useCashierOrderSelection([queued], 'visible'), {
      initialProps: { queued: visible },
    });
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));

    const changed = {
      ...visible,
      notes: 'No onions; allergy confirmed',
      permittedActions: [{ action: 'DecideMarketplaceOrder', allowed: true, requiresReason: true }],
    } as OrderDto;
    rerender({ queued: changed });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.isSnapshotFresh).toBe(false);
    expect(mockGetOrderById).toHaveBeenCalledTimes(2);
    act(() => resolveRefresh(changed));
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));
    expect(result.current.order?.notes).toBe('No onions; allergy confirmed');
  });

  it('keeps a failed background refresh stale until an explicit retry succeeds', async () => {
    const visible = { ...order('visible'), version: 7, updatedAt: '2026-10-02T17:00:00Z' } as OrderDto;
    let resolveRetry: (value: OrderDto) => void = () => undefined;
    mockGetOrderById
      .mockResolvedValueOnce(visible)
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(
        () =>
          new Promise<OrderDto>((resolve) => {
            resolveRetry = resolve;
          }),
      );
    const { result, rerender } = renderHook(({ queued }) => useCashierOrderSelection([queued], 'visible'), {
      initialProps: { queued: visible },
    });
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));

    rerender({ queued: { ...visible, version: 8, updatedAt: '2026-10-02T17:01:00Z' } });
    await waitFor(() => expect(result.current.error).toBe('cashier.workspace.order_unavailable'));
    expect(result.current.order?.id).toBe('visible');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isSnapshotFresh).toBe(false);

    act(() => result.current.refresh());
    await waitFor(() => expect(mockGetOrderById).toHaveBeenCalledTimes(3));
    expect(result.current.isRefreshing).toBe(true);
    act(() => resolveRetry({ ...visible, version: 8, updatedAt: '2026-10-02T17:01:00Z' }));
    await waitFor(() => expect(result.current.isSnapshotFresh).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('clears the previous deep-linked ticket while the next one loads', async () => {
    let resolveNext: (value: OrderDto) => void = () => undefined;
    mockGetOrderById.mockResolvedValueOnce(order('first')).mockImplementationOnce(
      () =>
        new Promise<OrderDto>((resolve) => {
          resolveNext = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ id }) => useCashierOrderSelection([], id), {
      initialProps: { id: 'first' },
    });
    await waitFor(() => expect(result.current.order?.id).toBe('first'));

    rerender({ id: 'second' });
    expect(result.current.order).toBeNull();
    expect(result.current.isLoading).toBe(true);
    act(() => resolveNext(order('second')));
    await waitFor(() => expect(result.current.order?.id).toBe('second'));
  });
});
