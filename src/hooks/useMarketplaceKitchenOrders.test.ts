import { act, renderHook, waitFor } from '@testing-library/react';
import { getMarketplaceOperationalOrders } from '@/services/serverService';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';
import { useMarketplaceKitchenOrders } from './useMarketplaceKitchenOrders';
import type { OrderDto } from '@/types/order';

jest.mock('@/services/serverService', () => ({ getMarketplaceOperationalOrders: jest.fn() }));

const mockGetOrders = jest.mocked(getMarketplaceOperationalOrders);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

afterEach(() => jest.restoreAllMocks());

it('ignores a slow poll when a newer mutation-triggered refresh has completed', async () => {
  const older = deferred<OrderDto[]>();
  const newer = deferred<OrderDto[]>();
  const oldOrder = marketplaceOrder();
  oldOrder.id = 'older-snapshot';
  const newOrder = marketplaceOrder();
  newOrder.id = 'newer-snapshot';
  const getOrders = mockGetOrders.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

  const { result } = renderHook(() => useMarketplaceKitchenOrders(true));
  await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(1));

  let newerRequest!: Promise<void>;
  act(() => {
    newerRequest = result.current.refresh();
  });
  expect(getOrders).toHaveBeenCalledTimes(2);

  await act(async () => {
    newer.resolve([newOrder]);
    await newerRequest;
  });
  expect(result.current.orders).toEqual([newOrder]);

  await act(async () => {
    older.resolve([oldOrder]);
    await Promise.resolve();
  });
  expect(result.current.orders).toEqual([newOrder]);
});
