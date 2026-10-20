import { act, renderHook, waitFor } from '@testing-library/react';
import { useCurrentOrderTicket } from './useCurrentOrderTicket';
import { getCurrentStaffTicket } from '@/services/currentStaffTicketService';
import { makeOrder, makeOrderItem } from '@/utils/__fixtures__/bundleOrderFixture';
import type { OrderDto } from '@/types/order';

jest.mock('@/services/currentStaffTicketService', () => ({ getCurrentStaffTicket: jest.fn() }));
const mockHistory = jest.mocked(getCurrentStaffTicket);
const source = makeOrder([makeOrderItem({ id: 'original', productName: 'Kebab' })]);

beforeEach(() => jest.clearAllMocks());
it('loads the group without opening history and refreshes when a later round changes', async () => {
  mockHistory.mockResolvedValue([source]);
  const round = { ...source, id: 'round', items: [makeOrderItem({ id: 'extra', productName: 'Ayran' })] };
  mockHistory.mockResolvedValue([source, round]);
  const { result, rerender } = renderHook(({ related }) => useCurrentOrderTicket(source, related), {
    initialProps: { related: [source, round] },
  });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.ticket?.items.map((item) => item.productName)).toEqual(['Kebab', 'Ayran']);
  expect(mockHistory).toHaveBeenCalledWith(source.id);
  rerender({ related: [source, { ...round, version: 1 }] });
  await waitFor(() => expect(mockHistory).toHaveBeenCalledTimes(2));
});

it('discards a late response for another order and permits recovery from errors', async () => {
  let finish: (value: OrderDto[]) => void = () => undefined;
  mockHistory.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mockHistory.mockRejectedValueOnce(new Error('offline'));
  const { result, rerender } = renderHook(({ order }) => useCurrentOrderTicket(order, undefined), {
    initialProps: { order: source },
  });
  rerender({ order: { ...source, id: 'another' } });
  await waitFor(() => expect(result.current.error).toBe(true));
  await act(async () => finish([]));
  expect(result.current.error).toBe(true);
  mockHistory.mockResolvedValue([source]);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(false);
});
