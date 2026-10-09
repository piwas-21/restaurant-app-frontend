import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckoutProvider, useCheckout } from '@/contexts/CheckoutContext';
import CheckoutTableGuestStateBridge from '@/contexts/CheckoutTableGuestStateBridge';
import { OrderTypeProvider, useOrderType } from '@/contexts/OrderTypeContext';
import { TableContextProvider, useTableContext } from '@/contexts/TableContext';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import OrderTypeToggleShell from '@/components/order/OrderTypeToggleShell';
import { OrderType } from '@/types/order';
import { useCartContents } from '@/hooks/order/useCartContents';
import { useEnabledOrderTypes } from './useEnabledOrderTypes';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import TableGuestRoundReviewContainer from '@/components/table-service/TableGuestRoundReviewContainer';
import type { CartState } from '@/components/cart/cartTypes';
import type { BasketDto } from '@/types/basket';
import type { BasketChannelSwitch } from '@/types/basketChannel';
import tableGuestEnglish from '@/locales/table-guest/en.json';

const mockGetEnabled = jest.fn<Promise<OrderType[]>, []>();
const mockPush = jest.fn();
const mockOuterPagePickType = jest.fn();
const mockSetBasketOrderType = jest.fn<Promise<BasketChannelSwitch>, [OrderType, boolean?]>();
const mockCreateRound = jest.fn();
const mockUpdateItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockClearError = jest.fn();
const mockClearCart = jest.fn();
const mockSyncBasket = jest.fn<Promise<boolean>, [string | null | undefined]>();
let mockCartState: CartState;
let mockCanonicalOrderType: OrderType | null;
let mockCartRevision = 0;
const mockCartStoreListeners = new Set<() => void>();
const mockRefreshCartStore = () => {
  mockCartRevision += 1;
  mockCartStoreListeners.forEach((listener) => listener());
};

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: () => mockGetEnabled() },
}));
jest.mock('@/services/tableGuestLocaleService', () => ({
  loadTableGuestLocale: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/cart/CartContext', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const subscribe = (listener: () => void) => {
    mockCartStoreListeners.add(listener);
    return () => mockCartStoreListeners.delete(listener);
  };
  const getSnapshot = () => mockCartRevision;
  return {
    useCart: () => {
      react.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      return {
        state: mockCartState,
        updateItem: mockUpdateItem,
        removeItem: mockRemoveItem,
        clearError: mockClearError,
        syncBasket: mockSyncBasket,
        clearCart: mockClearCart,
      };
    },
  };
});
jest.mock('@/services/basketChannelService', () => ({
  setBasketOrderType: (...args: [OrderType, boolean?]) => mockSetBasketOrderType(...args),
  clearBasketOrderType: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/tableGuestVisitService', () => ({
  tableGuestVisitService: {
    joinTableGuestVisit: jest.fn(),
    getTableGuestAccount: jest.fn(),
    createTableGuestRound: (...args: unknown[]) => mockCreateRound(...args),
  },
  isUnavailableVisitError: () => false,
  isExpiredVisitError: () => false,
}));
jest.mock('@/contexts/SessionContext', () => ({ useSessionContext: () => ({ ensureSession: () => 'session-1' }) }));
jest.mock('@/contexts/ModulesContext', () => ({ useModuleEnabled: () => false }));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));

function makeCartState(basket: BasketDto): CartState {
  return {
    items: basket.items.map((item) => ({ ...item, basketItemId: item.id })),
    basket,
    isLoading: false,
    isSyncing: false,
    error: null,
    lastSyncedAt: Date.now(),
  };
}

function removeTakeawayOnlyLine() {
  if (!mockCartState.basket) return;
  const items = mockCartState.basket.items.filter((item) => item.id !== 'line-takeaway');
  const basket = {
    ...mockCartState.basket,
    items,
    purchaseFingerprint: 'B'.repeat(64),
    totalItems: 1,
    subTotal: 10,
    total: 10,
  };
  mockCartState = makeCartState(basket);
  mockRefreshCartStore();
}

function RetrySurface() {
  const tableGuest = useTableGuestDineInAvailability();
  const orderTypes = useEnabledOrderTypes();
  return (
    <>
      <p data-testid="visit-phase">{tableGuest.phase}</p>
      <p data-testid="retry-surface-state">{tableGuest.dineInAvailable ? 'available' : 'blocked'}</p>
      <p data-testid="public-read-state">
        {orderTypes.loading
          ? 'loading'
          : orderTypes.confirmed && orderTypes.enabled.includes(OrderType.DineIn)
            ? 'available'
            : 'closed'}
      </p>
      <button
        type="button"
        data-testid="retry-availability"
        onClick={() => void tableGuest.refreshDineInAvailability()}
      >
        Retry availability
      </button>
    </>
  );
}

function FollowUpAndCheckoutSurface({
  followUp,
  showReview = false,
}: {
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
  showReview?: boolean;
}) {
  const cart = useCartContents({ pickType: followUp.pickType });
  const tableGuest = useTableGuestDineInAvailability();
  const { state: orderTypeState } = useOrderType();
  const { state: checkoutState } = useCheckout();
  const { tableContext } = useTableContext();

  return (
    <>
      <p data-testid="checkout-surface-state">{tableGuest.dineInAvailable ? 'available' : 'blocked'}</p>
      <p data-testid="follow-up-state">{followUp.followUp ?? 'none'}</p>
      <p data-testid="cart-can-checkout">{cart.canCheckout ? 'yes' : 'no'}</p>
      <p data-testid="recovered-order-type">{orderTypeState.orderType ?? 'none'}</p>
      <p data-testid="recovered-order-table">{orderTypeState.table || 'none'}</p>
      <p data-testid="checkout-order-type">{checkoutState.orderType ?? 'none'}</p>
      <p data-testid="checkout-table-number">{checkoutState.tableNumber || 'none'}</p>
      <p data-testid="pinned-table-context">{tableContext.tableNumber ?? 'none'}</p>
      <OrderTypeToggleShell
        onPick={cart.handlePick}
        styles={{
          group: 'group',
          button: 'button',
          active: 'active',
          icon: 'icon',
          label: 'label',
          skeleton: 'skeleton',
        }}
      />
      <button type="button" onClick={cart.handleCheckout}>
        Cart proceed to checkout
      </button>
      {showReview && <TableGuestRoundReviewContainer formatPrice={(amount) => amount.toFixed(2)} />}
      {showReview && (
        <button type="button" data-testid="remove-takeaway-line" onClick={removeTakeawayOnlyLine}>
          Remove takeaway-only line
        </button>
      )}
    </>
  );
}

function MenuPageControllerOutsideGuestRuntime({ showReview = false }: { showReview?: boolean }) {
  const followUp = useOrderTypeFollowUp();
  const { pickType: followUpPickType } = followUp;
  const pagePickType = React.useCallback(
    (type: OrderType, source?: string, forceModal?: boolean) => {
      mockOuterPagePickType(type, source, forceModal);
      return followUpPickType(type, source, forceModal);
    },
    [followUpPickType],
  );
  const cartFollowUp = { ...followUp, pickType: pagePickType };
  return (
    <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
      <TableGuestVisitProvider>
        <CheckoutTableGuestStateBridge>
          <RetrySurface />
          <FollowUpAndCheckoutSurface followUp={cartFollowUp} showReview={showReview} />
        </CheckoutTableGuestStateBridge>
      </TableGuestVisitProvider>
    </TableGuestFeatureProvider>
  );
}

describe('shared table guest Dine-In availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rumi_session_id', 'session-1');
    mockCartState = {
      items: [{ quantity: 1, unitPrice: 2, itemTotal: 2 }],
      basket: null,
      isLoading: false,
      isSyncing: false,
      error: null,
      lastSyncedAt: null,
    };
    mockCanonicalOrderType = null;
    mockCartRevision = 0;
    mockCartStoreListeners.clear();
    mockSyncBasket.mockReset();
    mockSyncBasket.mockResolvedValue(true);
    mockSetBasketOrderType.mockReset();
    mockCreateRound.mockReset();
    sessionStorage.setItem(
      'rumi_table_guest_visit_v1',
      JSON.stringify({
        serviceSessionId: 'session-1',
        participantToken: 'p'.repeat(32),
        expiresAt: '2030-01-01T00:00:00.000Z',
        tableId: 'table-11',
      }),
    );
    sessionStorage.setItem(
      'rumi_table_context',
      JSON.stringify({
        tableId: 'table-11',
        tableNumber: '11a',
        qrScanned: true,
        isOutdoor: false,
        dineInPinned: true,
      }),
    );
    mockGetEnabled.mockReset();
    mockOuterPagePickType.mockReset();
    mockGetEnabled
      .mockResolvedValueOnce([OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.DineIn, OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.Takeaway]);
    i18n.addResourceBundle('en', 'translation', tableGuestEnglish, true, true);
  });

  it('unblocks every mounted consumer after one retry and restores the pinned table visit', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableContextProvider>
          <CheckoutProvider>
            <OrderTypeProvider>
              <MenuPageControllerOutsideGuestRuntime />
            </OrderTypeProvider>
          </CheckoutProvider>
        </TableContextProvider>
      </I18nextProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('retry-surface-state')).toHaveTextContent('blocked'));
    await waitFor(() => expect(screen.getByTestId('visit-phase')).toHaveTextContent('active'));
    await waitFor(() => expect(screen.getByTestId('public-read-state')).toHaveTextContent('closed'));
    expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('blocked');
    expect(screen.getByTestId('cart-can-checkout')).toHaveTextContent('no');
    expect(screen.getByTestId('follow-up-state')).toHaveTextContent('none');
    expect(screen.getByTestId('recovered-order-type')).toHaveTextContent('none');
    expect(screen.getByTestId('checkout-order-type')).toHaveTextContent('none');
    await waitFor(() => expect(mockGetEnabled).toHaveBeenCalledTimes(2));

    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-availability'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry-surface-state')).toHaveTextContent('available');
      expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('available');
      expect(screen.getByTestId('follow-up-state')).toHaveTextContent('none');
      expect(screen.getByTestId('recovered-order-type')).toHaveTextContent(OrderType.DineIn);
      expect(screen.getByTestId('recovered-order-table')).toHaveTextContent('11a');
      expect(screen.getByTestId('checkout-order-type')).toHaveTextContent(OrderType.DineIn);
      expect(screen.getByTestId('checkout-table-number')).toHaveTextContent('11a');
      expect(screen.getByTestId('pinned-table-context')).toHaveTextContent('11a');
      expect(screen.getByTestId('cart-can-checkout')).toHaveTextContent('yes');
      expect(screen.getByRole('button', { name: /Dine In/i })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(mockGetEnabled).toHaveBeenCalledTimes(3);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dine In/i }));
    });
    expect(mockOuterPagePickType).not.toHaveBeenCalled();
    expect(screen.getByTestId('follow-up-state')).toHaveTextContent('none');
    expect(screen.getByTestId('recovered-order-type')).toHaveTextContent(OrderType.DineIn);

    fireEvent.click(screen.getByRole('button', { name: 'Cart proceed to checkout' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/checkout/review'));
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');

    await act(async () => {
      fireEvent.focus(window);
    });
    await waitFor(() => {
      expect(screen.getByTestId('public-read-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('blocked');
      expect(screen.getByTestId('cart-can-checkout')).toHaveTextContent('no');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cart proceed to checkout' }));
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockGetEnabled).toHaveBeenCalledTimes(4);
  });

  it('keeps review blocked after channel refusal, then unlocks after the guest removes the conflict', async () => {
    const basket: BasketDto = {
      id: 'basket-guest',
      sessionId: 'session-1',
      purchaseFingerprint: 'A'.repeat(64),
      subTotal: 20,
      tax: 0,
      deliveryFee: 0,
      discount: 0,
      customerDiscount: 0,
      total: 20,
      totalItems: 2,
      orderType: OrderType.Takeaway,
      items: [
        { id: 'line-dinein', productId: 'soup', productName: 'Soup', quantity: 1, unitPrice: 10, itemTotal: 10 },
        {
          id: 'line-takeaway',
          productId: 'wrap',
          productName: 'Wrap',
          quantity: 1,
          unitPrice: 10,
          itemTotal: 10,
        },
      ],
    };
    mockCartState = makeCartState(basket);
    mockCanonicalOrderType = OrderType.Takeaway;
    mockSyncBasket.mockImplementation(async (expectedSessionId) => {
      if (expectedSessionId !== 'session-1' || !mockCartState.basket) return false;
      mockCartState = makeCartState({ ...mockCartState.basket, orderType: mockCanonicalOrderType });
      mockRefreshCartStore();
      return true;
    });
    mockSetBasketOrderType.mockImplementation(async (orderType, removeConflicts = false) => {
      const conflictExists = mockCartState.basket?.items.some((item) => item.id === 'line-takeaway') ?? false;
      const conflicts = conflictExists
        ? [
            {
              basketItemId: 'line-takeaway',
              productId: 'wrap',
              productName: 'Wrap',
              quantity: 1,
              allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
            },
          ]
        : [];
      if (orderType === OrderType.DineIn && conflicts.length > 0 && !removeConflicts) {
        return { applied: false, conflicts, removed: [], basket: mockCartState.basket };
      }
      mockCanonicalOrderType = orderType;
      return { applied: true, conflicts: [], removed: [], basket: mockCartState.basket };
    });

    render(
      <I18nextProvider i18n={i18n}>
        <TableContextProvider>
          <CheckoutProvider>
            <OrderTypeProvider>
              <MenuPageControllerOutsideGuestRuntime showReview />
            </OrderTypeProvider>
          </CheckoutProvider>
        </TableContextProvider>
      </I18nextProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('visit-phase')).toHaveTextContent('active'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-availability'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('recovered-order-type')).toHaveTextContent(OrderType.DineIn);
      expect(mockSetBasketOrderType).toHaveBeenCalledTimes(1);
      expect(mockSyncBasket).toHaveBeenCalledTimes(1);
    });

    expect(mockSetBasketOrderType).toHaveBeenNthCalledWith(1, OrderType.DineIn, false);
    expect(mockCartState.basket?.orderType).toBe(OrderType.Takeaway);
    expect(mockCartState.items).toHaveLength(2);
    expect(screen.queryByRole('button', { name: tableGuestEnglish.table_guest_round_action })).not.toBeInTheDocument();
    expect(screen.getByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).toBeVisible();
    expect(screen.getByRole('link', { name: tableGuestEnglish.table_guest_round_edit })).toHaveAttribute(
      'href',
      '/cart',
    );
    expect(mockCreateRound).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-takeaway-line'));
    });
    expect(mockCartState.items).toHaveLength(1);

    await waitFor(() => {
      expect(mockSetBasketOrderType).toHaveBeenCalledTimes(2);
      expect(mockCartState.basket?.orderType).toBe(OrderType.DineIn);
      expect(screen.getByRole('button', { name: tableGuestEnglish.table_guest_round_action })).toBeEnabled();
    });
    expect(mockSetBasketOrderType).toHaveBeenNthCalledWith(2, OrderType.DineIn, false);
    expect(mockCartState.items).toHaveLength(1);
    expect(screen.queryByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).not.toBeInTheDocument();
    expect(mockCreateRound).not.toHaveBeenCalled();
  });
});
