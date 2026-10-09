import { act, renderHook, waitFor } from '@testing-library/react';
import { setBasketOrderType } from '@/services/basketChannelService';
import type { BasketDto } from '@/types/basket';
import type { BasketChannelSwitch } from '@/types/basketChannel';
import { OrderType } from '@/types/order';
import { ApiError } from '@/utils/apiClient';
import { retryBasketChannelSnapshot, setBasketOrderTypeAndRefresh } from './basketChannelMutation';
import { useBasketChannelRecovery } from './useBasketChannelRecovery';

jest.mock('@/services/basketChannelService', () => ({ setBasketOrderType: jest.fn() }));

const mockedSet = setBasketOrderType as jest.MockedFunction<typeof setBasketOrderType>;
const syncBasket = jest.fn(async (_expectedSessionId?: string | null) => true);

function response(overrides: Partial<BasketChannelSwitch> = {}): BasketChannelSwitch {
  return { applied: true, conflicts: [], removed: [], basket: null, ...overrides };
}

function basket(orderType: OrderType): BasketDto {
  return {
    id: 'basket-1',
    sessionId: undefined,
    orderType,
    items: [{ id: 'line-1' }],
  } as unknown as BasketDto;
}

beforeEach(async () => {
  localStorage.clear();
  syncBasket.mockResolvedValue(true);
  await retryBasketChannelSnapshot(syncBasket);
  jest.clearAllMocks();
});

it('keeps checkout blocked after a failed write and refresh, then retries through a fresh matching snapshot', async () => {
  mockedSet.mockRejectedValueOnce(new Error('channel PUT rejected'));
  syncBasket.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

  await act(async () => {
    await expect(
      setBasketOrderTypeAndRefresh(OrderType.Takeaway, basket(OrderType.DineIn), syncBasket),
    ).rejects.toThrow('channel PUT rejected');
  });

  const { result, rerender } = renderHook(
    ({ currentBasket }: { currentBasket: BasketDto }) =>
      useBasketChannelRecovery(currentBasket, OrderType.Takeaway, syncBasket),
    { initialProps: { currentBasket: basket(OrderType.DineIn) } },
  );

  expect(result.current.isPending).toBe(true);
  expect(result.current.isVisible).toBe(true);

  mockedSet.mockResolvedValueOnce(response());
  await act(async () => result.current.retry());

  // The retry's PUT and GET succeeded, but the renderer still holds the stale Dine-In snapshot.
  // Keep Proceed blocked until CartProvider renders the fresh Takeaway channel.
  expect(result.current.isPending).toBe(true);
  expect(result.current.isVisible).toBe(true);

  rerender({ currentBasket: basket(OrderType.Takeaway) });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  expect(result.current.isVisible).toBe(false);
  expect(mockedSet).toHaveBeenCalledTimes(2);
  expect(syncBasket).toHaveBeenCalledTimes(2);
});

it('shows the server error when the explicit channel retry fails', async () => {
  mockedSet.mockRejectedValueOnce(new Error('first write failed'));
  syncBasket.mockResolvedValueOnce(false);

  await act(async () => {
    await expect(
      setBasketOrderTypeAndRefresh(OrderType.Takeaway, basket(OrderType.DineIn), syncBasket),
    ).rejects.toThrow('first write failed');
  });

  mockedSet.mockRejectedValueOnce(new ApiError(503, 'The basket channel could not be confirmed by the server.'));
  const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useBasketChannelRecovery(basket(OrderType.DineIn), OrderType.Takeaway, syncBasket),
  );

  await act(async () => result.current.retry());

  expect(result.current.isPending).toBe(true);
  expect(result.current.isVisible).toBe(true);
  expect(result.current.errorMessage).toBe('The basket channel could not be confirmed by the server.');
  logError.mockRestore();
});
