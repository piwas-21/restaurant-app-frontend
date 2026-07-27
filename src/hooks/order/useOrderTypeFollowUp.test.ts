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

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ setOrderType: mockSetOrderType, setTable: mockSetTable }),
}));
jest.mock('@/contexts/TableContext', () => ({
  useTableContext: () => mockTableState,
}));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: mockCustomerInfo } }),
}));
jest.mock('@/services/userService', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));

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
