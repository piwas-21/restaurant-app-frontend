import { act, renderHook } from '@testing-library/react';
import { useKitchenBoardView } from './useKitchenBoardView';
const mockPlay = jest.fn();
const mockSound = { playNotificationSound: mockPlay, repeatUntilMouseMoves: false };
jest.mock('@/hooks/notification/useNotificationSound', () => ({ useNotificationSound: () => mockSound }));
const order = (id: string, createdAt: string, status = 'Confirmed', isCompleted = false) => ({
  orderId: id,
  orderNumber: id,
  dailyOrderNumber: Number(id),
  tableLabel: null,
  tableNumber: null,
  status,
  isCompleted,
  type: 'Takeaway',
  createdAt,
  items: [{ productName: 'Soup' }],
});
beforeEach(() => mockPlay.mockClear());
it('sorts shuffled orders newest first and separates completed work without changing their status', () => {
  const orders = [
    order('1', '2026-10-17T10:00:00Z'),
    order('3', '2026-10-17T10:02:00Z', 'Completed'),
    order('2', '2026-10-17T10:01:00Z'),
  ];
  const view = renderHook(() => useKitchenBoardView(orders, [], true));
  expect(view.result.current.visibleOrders.map((value) => value.orderId)).toEqual(['2', '1']);
  expect(mockPlay).not.toHaveBeenCalled();
  act(() => view.result.current.setView('completed'));
  expect(view.result.current.visibleOrders.map((value) => value.orderId)).toEqual(['3']);
  expect(orders[0].status).toBe('Confirmed');
});
it('sounds once for newly arrived work and keeps search and channel filters independent of status', () => {
  const first = order('1', '2026-10-17T10:00:00Z');
  const view = renderHook(({ orders }) => useKitchenBoardView(orders, [], true), { initialProps: { orders: [first] } });
  view.rerender({ orders: [first, order('2', '2026-10-17T10:01:00Z')] });
  expect(mockPlay).toHaveBeenCalledTimes(1);
  act(() => view.result.current.setSearch('soup'));
  expect(view.result.current.visibleOrders).toHaveLength(2);
  act(() => view.result.current.setType('DineIn'));
  expect(view.result.current.visibleOrders).toHaveLength(0);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});
