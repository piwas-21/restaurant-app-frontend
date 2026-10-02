import { act, renderHook } from '@testing-library/react';
import { useChannelOrderSnapshot } from './useChannelOrderSnapshot';
import { getOrderById } from '@/services/order/orderQueries';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import type { OrderDto } from '@/types/order';

jest.mock('@/services/order/orderQueries');
const order = (id = 'first', version = 1): OrderDto => ({ ...marketplaceOrder(), id, version });
const deferred = () => {
  let resolve!: (value: OrderDto) => void;
  return {
    promise: new Promise<OrderDto>((done) => {
      resolve = done;
    }),
    resolve: (value: OrderDto) => resolve(value),
  };
};
beforeEach(() => jest.clearAllMocks());
it('refreshes order/version in place without a mutation callback', async () => {
  jest.mocked(getOrderById).mockResolvedValue(order('first', 2));
  const { result } = renderHook(() => useChannelOrderSnapshot(order()));
  await act(async () => result.current.refreshOrder());
  expect(result.current.order.version).toBe(2);
});
it('ignores an old detail response after switching tickets', async () => {
  const read = deferred();
  jest.mocked(getOrderById).mockReturnValue(read.promise);
  const { result, rerender } = renderHook(({ value }) => useChannelOrderSnapshot(value), {
    initialProps: { value: order() },
  });
  act(() => result.current.refreshOrder());
  rerender({ value: order('second') });
  await act(async () => read.resolve(order('first', 99)));
  expect(result.current.order.id).toBe('second');
});
it('invalidates an old response even if the operator switches away and back', async () => {
  const read = deferred();
  jest.mocked(getOrderById).mockReturnValue(read.promise);
  const { result, rerender } = renderHook(({ value }) => useChannelOrderSnapshot(value), {
    initialProps: { value: order() },
  });
  act(() => result.current.refreshOrder());
  rerender({ value: order('second') });
  rerender({ value: order('first', 2) });
  await act(async () => read.resolve(order('first', 99)));
  expect(result.current.order.version).toBe(2);
});
it('ignores an unexpected order identity and a regressive version', async () => {
  jest
    .mocked(getOrderById)
    .mockResolvedValueOnce(order('other', 50))
    .mockResolvedValueOnce(order('first', 2))
    .mockResolvedValueOnce(order('first', 1));
  const { result } = renderHook(() => useChannelOrderSnapshot(order()));
  await act(async () => result.current.refreshOrder());
  expect(result.current.order.id).toBe('first');
  await act(async () => result.current.refreshOrder());
  expect(result.current.order.version).toBe(2);
  await act(async () => result.current.refreshOrder());
  expect(result.current.order.version).toBe(2);
});
it('does not update after unmount', async () => {
  const read = deferred();
  jest.mocked(getOrderById).mockReturnValue(read.promise);
  const { result, unmount } = renderHook(() => useChannelOrderSnapshot(order()));
  act(() => result.current.refreshOrder());
  unmount();
  await act(async () => read.resolve(order('first', 99)));
  expect(result.current.order.version).toBe(1);
});

it('exposes a failed read and clears it when a fresh retry succeeds', async () => {
  const refusal = new Error('temporarily unavailable');
  jest.mocked(getOrderById).mockRejectedValueOnce(refusal).mockResolvedValueOnce(order('first', 2));
  const { result } = renderHook(() => useChannelOrderSnapshot(order()));
  await act(async () => result.current.refreshOrder());
  expect(result.current.refreshError).toBe(refusal);
  expect(result.current.order.version).toBe(1);
  await act(async () => result.current.refreshOrder());
  expect(result.current.refreshError).toBeNull();
  expect(result.current.order.version).toBe(2);
});
