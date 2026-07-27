import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { OrderTypeProvider, useOrderType, ORDER_TYPE_TTL_MS } from './OrderTypeContext';

const mockCheckoutState = {
  orderType: null as OrderType | null,
  tableNumber: null as string | null,
  deliveryAddress: null,
};
const mockClearOrderTypeSelection = jest.fn();
const mockCheckoutSetOrderType = jest.fn();
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({
    state: mockCheckoutState,
    setOrderType: mockCheckoutSetOrderType,
    setTableNumber: jest.fn(),
    setDeliveryAddress: jest.fn(),
    clearOrderTypeSelection: mockClearOrderTypeSelection,
  }),
}));
// The provider mounts the G4/G8 guard; it has its own suite and would otherwise pull in a fetch.
jest.mock('@/hooks/order/useOrderTypeEnabledGuard', () => ({ useOrderTypeEnabledGuard: jest.fn() }));

const STORAGE_KEY = 'rumi_order_type_state';

function Probe() {
  const { state, hasChosenOrderType, setOrderType, clearOrderType } = useOrderType();
  return (
    <div>
      <span data-testid="type">{state.orderType ?? 'none'}</span>
      <span data-testid="table">{state.table || 'none'}</span>
      <span data-testid="chosen">{String(hasChosenOrderType)}</span>
      <button onClick={() => setOrderType(OrderType.Delivery)}>pick</button>
      <button onClick={clearOrderType}>clear</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <OrderTypeProvider>
      <Probe />
    </OrderTypeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockCheckoutState.orderType = null;
  mockCheckoutState.tableNumber = null;
});

describe('OrderTypeContext — 24h TTL on the persisted choice (gap G3)', () => {
  it('keeps a choice made inside the window', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ orderType: OrderType.Delivery, table: '', deliveryAddress: null, chosenAt: Date.now() - 1000 }),
    );

    renderProvider();

    expect(screen.getByTestId('type')).toHaveTextContent(OrderType.Delivery);
    expect(screen.getByTestId('chosen')).toHaveTextContent('true');
  });

  it('drops a choice older than the window — a month-old Delivery must not filter the menu', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        orderType: OrderType.Delivery,
        table: '',
        deliveryAddress: { street: 'Old St', city: 'Geneva' },
        chosenAt: Date.now() - ORDER_TYPE_TTL_MS - 1,
      }),
    );

    renderProvider();

    expect(screen.getByTestId('type')).toHaveTextContent('none');
    expect(screen.getByTestId('chosen')).toHaveTextContent('false');
  });

  it('expires the companions too, so no orphan table survives the type', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        orderType: OrderType.DineIn,
        table: '5',
        deliveryAddress: null,
        chosenAt: Date.now() - ORDER_TYPE_TTL_MS - 1,
      }),
    );

    renderProvider();

    expect(screen.getByTestId('table')).toHaveTextContent('none');
  });

  // Payloads written before `chosenAt` existed carry no age, and a five-minute-old choice is
  // indistinguishable from a month-old one — so they expire rather than being trusted forever.
  it('expires a pre-TTL payload that has no timestamp', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ orderType: OrderType.Takeaway, table: '', deliveryAddress: null }),
    );

    renderProvider();

    expect(screen.getByTestId('type')).toHaveTextContent('none');
  });

  it('stamps a fresh choice so it survives the next load', () => {
    renderProvider();

    act(() => screen.getByRole('button', { name: 'pick' }).click());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.orderType).toBe(OrderType.Delivery);
    expect(stored.chosenAt).toEqual(expect.any(Number));
    expect(Date.now() - stored.chosenAt).toBeLessThan(ORDER_TYPE_TTL_MS);
  });
});

describe('OrderTypeContext — clearing mirrors into CheckoutContext', () => {
  // The mirror is one-directional, so a clear that touched only this store was a HALF clear: the
  // menu went back to "no type chosen" while `useCheckoutPrereqGuard` and the tax calculation
  // kept reading the abandoned channel out of CheckoutContext, and the guest could still place an
  // order on it. Every clear path (24h TTL, the enabled-list guard, clearing the table) goes
  // through here.
  it('clears the mirrored order type, not just its own copy', () => {
    renderProvider();

    act(() => screen.getByRole('button', { name: 'clear' }).click());

    expect(mockClearOrderTypeSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('type')).toHaveTextContent('none');
  });

  it('picking a type still mirrors it across', () => {
    renderProvider();

    act(() => screen.getByRole('button', { name: 'pick' }).click());

    expect(mockCheckoutSetOrderType).toHaveBeenCalledWith(OrderType.Delivery);
  });
});
