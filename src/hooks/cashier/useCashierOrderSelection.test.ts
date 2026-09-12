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
