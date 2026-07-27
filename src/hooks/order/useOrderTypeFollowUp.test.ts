import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useOrderTypeFollowUp } from './useOrderTypeFollowUp';

const mockSetOrderType = jest.fn();
const mockSetTable = jest.fn();
// Complete customer info, so needsTakeawayInfoModal() returns false by default.
const mockCustomerInfo = { name: 'Guest', email: 'g@test.local', phone: '+41791234567' };

// Mutable so a test can put the hook on a QR-scan landing. `setTableContext` writes back into it,
// mirroring the real provider — the "already pinned" marker has to survive a REMOUNT, which is the
// whole reason it lives on the table context rather than in a ref.
const mockTableState = {
  hasTableContext: false,
  tableContext: {
    tableId: null as string | null,
    tableNumber: '' as string | null,
    dineInPinned: false as boolean | undefined,
  },
  setTableContext: jest.fn((patch: Record<string, unknown>) => {
    Object.assign(mockTableState.tableContext, patch);
  }),
};

// `state` is read by the switch flow to short-circuit a re-pick of the type already in force.
const mockOrderTypeState = { orderType: null as string | null };
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState, setOrderType: mockSetOrderType, setTable: mockSetTable }),
}));
jest.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ ensureSession: jest.fn().mockReturnValue('session-1') }),
}));
jest.mock('@/contexts/TableContext', () => ({
  useTableContext: () => mockTableState,
}));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: mockCustomerInfo } }),
}));
jest.mock('@/services/userService', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));

// The hook now owns the two-phase channel switch (§4.4), which reads the cart to decide whether a
// conflict check is even possible. Default to an EMPTY cart so these tests keep exercising the
// pick/follow-up flow they were written for — the switch protocol itself is pinned separately in
// useOrderTypeSwitch.test.ts. `mockSetBasketOrderType` still records that the server is told.
const mockSetBasketOrderType = jest.fn().mockResolvedValue({ applied: true, conflicts: [], removed: [], basket: null });
const mockCartState = { items: [] as unknown[], basket: { items: [] as unknown[] } };
jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ state: mockCartState, syncBasket: jest.fn() }),
}));
jest.mock('@/services/basketChannelService', () => ({
  setBasketOrderType: (...args: unknown[]) => mockSetBasketOrderType(...args),
}));

const scanTable = (tableId: string, tableNumber: string) => {
  mockTableState.hasTableContext = true;
  mockTableState.tableContext = { tableId, tableNumber, dineInPinned: false };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTableState.hasTableContext = false;
  mockTableState.tableContext = { tableId: null, tableNumber: '', dineInPinned: false };
});

// G1. A physical scan is the strongest signal there is, so it wins over a stored choice — the
// alternative left the banner saying "Ordering for Table 5" while the order type said Takeaway.
describe('useOrderTypeFollowUp — QR scan pins dine-in (gap G1)', () => {
  it('pins DineIn and the scanned table on a QR landing', () => {
    scanTable('t-5', '5');

    renderHook(() => useOrderTypeFollowUp());

    expect(mockSetOrderType).toHaveBeenCalledWith(OrderType.DineIn);
    expect(mockSetTable).toHaveBeenCalledWith('5');
  });

  // The gate used to be `!hasChosenOrderType`; dropping it entirely would instead re-pin DineIn on
  // every render, fighting a guest who deliberately switches away while seated. Once per scan.
  it('pins once per scanned table, so a later deliberate switch sticks', () => {
    scanTable('t-5', '5');

    const { rerender } = renderHook(() => useOrderTypeFollowUp());
    rerender();
    rerender();

    expect(mockSetOrderType).toHaveBeenCalledTimes(1);
  });

  // The bug a `useRef` marker had: this hook is mounted per ROUTE (/menu, /cart,
  // /checkout/review) while the scan lives in sessionStorage across all of them, so a ref reset on
  // every navigation and silently re-pinned Dine-In over a deliberate Takeaway.
  it('does NOT re-pin after a remount — navigating between pages must not undo a switch', () => {
    scanTable('t-5', '5');

    renderHook(() => useOrderTypeFollowUp()).unmount();
    renderHook(() => useOrderTypeFollowUp());

    expect(mockSetOrderType).toHaveBeenCalledTimes(1);
  });

  it('pins again when a DIFFERENT table is scanned', () => {
    scanTable('t-5', '5');
    const { rerender } = renderHook(() => useOrderTypeFollowUp());

    scanTable('t-9', '9');
    rerender();

    expect(mockSetOrderType).toHaveBeenCalledTimes(2);
    expect(mockSetTable).toHaveBeenLastCalledWith('9');
  });

  it('does nothing without a table context', () => {
    renderHook(() => useOrderTypeFollowUp());

    expect(mockSetOrderType).not.toHaveBeenCalled();
  });

  it('does nothing when the table context has an id but no number', () => {
    mockTableState.hasTableContext = true;
    mockTableState.tableContext = { tableId: 't-5', tableNumber: null, dineInPinned: false };

    renderHook(() => useOrderTypeFollowUp());

    expect(mockSetOrderType).not.toHaveBeenCalled();
  });
});

describe('useOrderTypeFollowUp', () => {
  it('forceModal opens the Takeaway modal even when the profile is already complete (Edit path)', async () => {
    const { result } = renderHook(() => useOrderTypeFollowUp());
    // pickType is async + drives its own state updates; waitFor absorbs the flush (no manual act).
    void result.current.pickType(OrderType.Takeaway, 'checkout_review', true);
    await waitFor(() => expect(result.current.followUp).toBe('takeaway'));
  });

  it('without forceModal, a Takeaway pick with complete info opens no modal', async () => {
    const { result } = renderHook(() => useOrderTypeFollowUp());
    // Open a modal first so the null assertion is meaningful (a real table→null transition).
    void result.current.pickType(OrderType.DineIn);
    await waitFor(() => expect(result.current.followUp).toBe('table'));

    void result.current.pickType(OrderType.Takeaway);
    await waitFor(() => expect(result.current.followUp).toBeNull());
  });

  it('editOrderType / editContact open the review-page editors without committing a type', () => {
    const { result } = renderHook(() => useOrderTypeFollowUp());
    mockSetOrderType.mockClear(); // ignore any commits from earlier tests sharing this mock

    act(() => result.current.editOrderType());
    expect(result.current.followUp).toBe('ordertype');

    act(() => result.current.editContact());
    expect(result.current.followUp).toBe('contact');

    // Opening an editor never commits an order type — that is pickType's job.
    expect(mockSetOrderType).not.toHaveBeenCalled();
  });
});

describe('useOrderTypeFollowUp — order-type switch with a non-empty cart (§4.4)', () => {
  const CONFLICT = {
    basketItemId: 'line-1',
    productName: 'Dürüm',
    quantity: 1,
    allowedOrderTypes: [OrderType.Takeaway],
  };

  beforeEach(() => {
    mockCartState.items = [{ id: 'line-1' }];
  });

  afterEach(() => {
    mockCartState.items = [];
  });

  it('does NOT commit the type, and opens no follow-up, while the confirm is pending', async () => {
    mockSetBasketOrderType.mockResolvedValueOnce({
      applied: false,
      conflicts: [CONFLICT],
      removed: [],
      basket: null,
    });
    const { result } = renderHook(() => useOrderTypeFollowUp());

    await act(async () => {
      await result.current.pickType(OrderType.DineIn);
    });

    expect(result.current.switchFlow.pending).toEqual({
      orderType: OrderType.DineIn,
      conflicts: [CONFLICT],
      source: 'sidebar',
      forceModal: false,
    });
    // Committing here would dim the whole menu and move the tax line for a switch the guest has not
    // agreed to — and the table modal would cover the very dialog asking them to agree.
    expect(mockSetOrderType).not.toHaveBeenCalled();
    expect(result.current.followUp).toBeNull();
  });

  it('commits the type AND runs the interrupted follow-up once the guest confirms', async () => {
    mockSetBasketOrderType.mockResolvedValueOnce({
      applied: false,
      conflicts: [CONFLICT],
      removed: [],
      basket: null,
    });
    const { result } = renderHook(() => useOrderTypeFollowUp());
    await act(async () => {
      await result.current.pickType(OrderType.DineIn);
    });

    mockSetBasketOrderType.mockResolvedValueOnce({ applied: true, conflicts: [], removed: [CONFLICT], basket: null });
    await act(async () => {
      result.current.confirmSwitch();
    });

    // The follow-up the switch interrupted still has to happen — a confirmed Dine-In switch that
    // never asks which table leaves the order untableable.
    expect(mockSetOrderType).toHaveBeenCalledWith(OrderType.DineIn);
    await waitFor(() => expect(result.current.followUp).toBe('table'));
  });

  it('cancelling the confirm commits nothing at all', async () => {
    mockSetBasketOrderType.mockResolvedValueOnce({
      applied: false,
      conflicts: [CONFLICT],
      removed: [],
      basket: null,
    });
    const { result } = renderHook(() => useOrderTypeFollowUp());
    await act(async () => {
      await result.current.pickType(OrderType.DineIn);
    });

    act(() => result.current.switchFlow.cancel());

    expect(result.current.switchFlow.pending).toBeNull();
    expect(mockSetOrderType).not.toHaveBeenCalled();
    expect(result.current.followUp).toBeNull();
  });
});
