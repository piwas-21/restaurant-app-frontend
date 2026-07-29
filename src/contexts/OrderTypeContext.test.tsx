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

// Resolves by DEFAULT, declared here rather than in a beforeEach: `clearOrderType` calls `.catch()`
// on the result, so a bare jest.fn() returning undefined throws inside every clear path in this
// file — including the two pre-existing mirror tests, which have nothing to do with §9.17. Reset
// with mockClear (not mockReset) below so the implementation survives, and use *Once for overrides.
const mockClearBasketOrderType = jest.fn<Promise<void>, []>(() => Promise.resolve());
jest.mock('@/services/basketChannelService', () => ({
  clearBasketOrderType: () => mockClearBasketOrderType(),
}));
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => mockTrackEvent(...args) }));

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
  // FAKE TIMERS FOR THE WHOLE FILE, not just the §9.17 block. The server disarm is deferred by a
  // macrotask, and several tests here render a provider over an EXPIRED payload — which now
  // legitimately schedules one. On real timers those callbacks land during whichever test happens
  // to be running when the event loop next turns, so the §9.17 counts were inflated by leakage from
  // tests that had already finished. Draining them per-test in afterEach keeps each test's count
  // its own.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
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
    // See also the §9.17 block below: expiring the choice locally is only half the job, because the
    // SERVER basket stays armed on the dropped channel. This suite asserted only the local half,
    // which is why a change that wired the disarm into `clearOrderType` alone looked complete — the
    // TTL never calls it.
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

describe('OrderTypeContext — clearing DISARMS the server basket (§9.17)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClearBasketOrderType.mockClear();
    mockTrackEvent.mockClear();
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    warnSpy = undefined;
  });

  let warnSpy: jest.SpyInstance | undefined;

  // Clearing locally was only half of it. The SERVER basket kept whatever channel it was given and
  // BasketChannelGuard judged every later add against it, so a guest holding no channel could still
  // be refused for one. Until the DELETE existed the client could not say this at all: the PUT takes
  // a non-nullable order type.
  //
  // TWO ENTRY POINTS, and conflating them is what made the first cut of this change wrong: this
  // callback (the enabled-list guard, unpinning a table, finishing a checkout) and HYDRATION (the
  // 24h TTL, which returns the empty state straight out of `loadState` and never reaches here).
  it('tells the server the basket has no channel', async () => {
    renderProvider();

    act(() => screen.getByRole('button', { name: 'clear' }).click());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockClearBasketOrderType).toHaveBeenCalledTimes(1);
  });

  it('disarms the server when the 24h TTL drops a stored channel', async () => {
    // The path the first cut of this change MISSED, and the flagship §9.17 case. The TTL is enforced
    // inside `loadState`, which returns the empty state directly — it never reaches `clearOrderType`
    // — so wiring the DELETE into that callback alone left a month-old Delivery expiring locally
    // while the server basket stayed armed on Delivery and refused every add.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        orderType: OrderType.Delivery,
        table: '',
        deliveryAddress: null,
        chosenAt: Date.now() - ORDER_TYPE_TTL_MS - 1,
      }),
    );

    renderProvider();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('type')).toHaveTextContent('none');
    expect(mockClearBasketOrderType).toHaveBeenCalledTimes(1);
  });

  it('does NOT disarm when there was no stored channel to expire', async () => {
    // The discriminating half: both outcomes leave `orderType` null, and only the expiry means the
    // server may still be armed. A disarm fired for a guest who simply never chose is a pointless
    // request on every cold load.
    renderProvider();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockClearBasketOrderType).not.toHaveBeenCalled();
  });

  it('a channel chosen before the disarm sends SUPERSEDES it', async () => {
    // `useOrderTypeEnabledGuard` clears then immediately sets (G4 → G8). Sending the DELETE inline
    // would race the PUT that asserts the new channel, and a DELETE landing last leaves the server
    // on null while the client holds a channel — the INVERSE of §9.17 and worse, since null is
    // permissive, so the guard would be disarmed and every add waved through. It would not
    // self-heal either: useAssertBasketChannel records the attempt and only retries on a line-count
    // change. The deferral plus the generation guard is what makes the last intent win.
    renderProvider();

    act(() => {
      screen.getByRole('button', { name: 'clear' }).click();
      screen.getByRole('button', { name: 'pick' }).click();
    });
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockClearBasketOrderType).not.toHaveBeenCalled();
    expect(screen.getByTestId('type')).toHaveTextContent(String(OrderType.Delivery));
  });

  it('still clears locally when the server call rejects, and TRACKS the divergence', async () => {
    // Fire-and-forget, so a failure must not block or surface — these paths are not guest-initiated.
    // But it must not be SILENT either: a basket still armed on a channel nobody holds refuses adds
    // for a reason the guest cannot see. Asserting the tracked event rather than only the console,
    // because a console warning on a guest's phone is observable by nobody (§9.13's rule).
    mockClearBasketOrderType.mockRejectedValueOnce(new Error('network'));
    // Restored in afterEach, not inline: an inline restore is skipped when an expectation above it
    // throws, leaving console.warn mocked for every later test in the file.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderProvider();

    act(() => screen.getByRole('button', { name: 'clear' }).click());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('type')).toHaveTextContent('none');
    expect(mockClearOrderTypeSelection).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('basket_channel_clear_failed');
  });
});
