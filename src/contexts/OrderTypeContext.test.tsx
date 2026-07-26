import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { OrderTypeProvider, useOrderType, ORDER_TYPE_TTL_MS } from './OrderTypeContext';

const checkoutState = {
  orderType: null as OrderType | null,
  tableNumber: null as string | null,
  deliveryAddress: null,
};
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({
    state: checkoutState,
    setOrderType: jest.fn(),
    setTableNumber: jest.fn(),
    setDeliveryAddress: jest.fn(),
  }),
}));
// The provider mounts the G4/G8 guard; it has its own suite and would otherwise pull in a fetch.
jest.mock('@/hooks/order/useOrderTypeEnabledGuard', () => ({ useOrderTypeEnabledGuard: jest.fn() }));

const STORAGE_KEY = 'rumi_order_type_state';

function Probe() {
  const { state, hasChosenOrderType, setOrderType } = useOrderType();
  return (
    <div>
      <span data-testid="type">{state.orderType ?? 'none'}</span>
      <span data-testid="table">{state.table || 'none'}</span>
      <span data-testid="chosen">{String(hasChosenOrderType)}</span>
      <button onClick={() => setOrderType(OrderType.Delivery)}>pick</button>
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
  localStorage.clear();
  checkoutState.orderType = null;
  checkoutState.tableNumber = null;
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

  it('dates a choice migrated from CheckoutContext as current, not as unknown', () => {
    // Otherwise the migration would hand back a choice that expires on the very next load.
    checkoutState.orderType = OrderType.Takeaway;

    renderProvider();

    expect(screen.getByTestId('type')).toHaveTextContent(OrderType.Takeaway);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.chosenAt).toEqual(expect.any(Number));
  });
});
