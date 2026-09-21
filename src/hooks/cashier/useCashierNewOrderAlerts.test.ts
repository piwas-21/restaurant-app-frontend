import { renderHook } from '@testing-library/react';
import { useCashierNewOrderAlerts } from './useCashierNewOrderAlerts';
import type { OrderDto } from '@/types/order';

const order = (id: string, overrides: Partial<OrderDto> = {}): OrderDto =>
  ({
    id,
    orderNumber: `ORD-${id}`,
    customerName: 'Ada',
    status: 'Pending',
    type: 'Takeaway',
    total: 10,
    totalPaid: 0,
    remainingAmount: 10,
    isFullyPaid: false,
    version: 1,
    isFocusOrder: false,
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    orderDate: '2026-09-20T10:00:00Z',
    items: [],
    payments: [],
    statusHistory: [],
    ...overrides,
  }) as OrderDto;

const notify = jest.fn();
const queuePending = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCashierNewOrderAlerts', () => {
  it('baselines every order in the initial REST load without an alert', () => {
    const { rerender } = renderHook(
      ({ orders, loading }) => useCashierNewOrderAlerts({ orders, isInitialLoading: loading, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[], loading: true } },
    );
    rerender({ orders: [order('a'), order('b')], loading: false });

    expect(notify).not.toHaveBeenCalled();
  });

  it('announces a Pending order immediately after the initial load settles', () => {
    const { rerender } = renderHook(
      ({ orders, loading }) => useCashierNewOrderAlerts({ orders, isInitialLoading: loading, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[], loading: true } },
    );
    rerender({ orders: [], loading: false });
    rerender({ orders: [order('new')], loading: false });

    expect(notify).toHaveBeenCalledWith('ORD-new', 'Ada');
  });

  it('hands a new Pending order to the workspace decision queue', () => {
    const { rerender } = renderHook(
      ({ orders }) =>
        useCashierNewOrderAlerts({
          orders,
          isInitialLoading: false,
          notifyNewOrder: notify,
          onPendingOrder: queuePending,
        }),
      { initialProps: { orders: [] as OrderDto[] } },
    );
    const arriving = order('review');

    rerender({ orders: [arriving] });

    expect(queuePending).toHaveBeenCalledWith(arriving);
  });

  it('announces each new order once — the seen-set, not the array length', () => {
    const { rerender } = renderHook(
      ({ orders }) => useCashierNewOrderAlerts({ orders, isInitialLoading: false, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[] } },
    );
    rerender({ orders: [order('x')] });
    rerender({ orders: [order('x')] });
    rerender({ orders: [order('x'), order('y')] });

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(2, 'ORD-y', 'Ada');
  });

  it('never re-announces an initial order whose status later becomes Pending again', () => {
    const { rerender } = renderHook(
      ({ orders }) => useCashierNewOrderAlerts({ orders, isInitialLoading: false, notifyNewOrder: notify }),
      { initialProps: { orders: [order('walked')] } },
    );
    rerender({ orders: [order('walked', { status: 'Confirmed' })] });
    rerender({ orders: [order('walked', { status: 'Pending' })] });

    expect(notify).not.toHaveBeenCalled();
  });

  it('marks non-Pending arrivals seen without alerting them later', () => {
    const { rerender } = renderHook(
      ({ orders }) => useCashierNewOrderAlerts({ orders, isInitialLoading: false, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[] } },
    );
    rerender({ orders: [order('auto', { status: 'Confirmed', type: 'DineIn' })] });
    rerender({ orders: [order('auto', { status: 'Pending', type: 'DineIn' })] });

    expect(notify).not.toHaveBeenCalled();
  });

  it('bounds the seen-id history for long cashier sessions', () => {
    const { rerender } = renderHook(
      ({ orders }) => useCashierNewOrderAlerts({ orders, isInitialLoading: false, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[] } },
    );
    const arrivals = Array.from({ length: 1001 }, (_, index) => order(`bulk-${index}`));
    rerender({ orders: arrivals });
    notify.mockClear();

    rerender({ orders: [arrivals[0]] });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('ORD-bulk-0', 'Ada');
  });

  it('never touches focus or opens a dialog', () => {
    const { rerender } = renderHook(
      ({ orders }) => useCashierNewOrderAlerts({ orders, isInitialLoading: false, notifyNewOrder: notify }),
      { initialProps: { orders: [] as OrderDto[] } },
    );
    rerender({ orders: [order('n')] });

    expect(document.activeElement).toBe(document.body);
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(0);
  });
});
