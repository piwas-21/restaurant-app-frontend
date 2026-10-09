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

const mockGetEnabled = jest.fn<Promise<OrderType[]>, []>();
const mockPush = jest.fn();
const mockOuterPagePickType = jest.fn();

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: () => mockGetEnabled() },
}));
jest.mock('@/services/tableGuestLocaleService', () => ({
  loadTableGuestLocale: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/cart/CartContext', () => {
  const state = { items: [{ quantity: 1, itemTotal: 2 }], error: null, isSyncing: false };
  const updateItem = jest.fn();
  const removeItem = jest.fn();
  const clearError = jest.fn();
  return { useCart: () => ({ state, updateItem, removeItem, clearError }) };
});
jest.mock('@/contexts/SessionContext', () => ({ useSessionContext: () => ({ ensureSession: () => 'session-1' }) }));
jest.mock('@/contexts/ModulesContext', () => ({ useModuleEnabled: () => false }));
jest.mock('@/hooks/useTenantLocaleRouter', () => ({ useTenantLocaleRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/order/useOrderTypeSwitch', () => ({
  useOrderTypeSwitch: () => ({
    pending: null,
    isApplying: false,
    error: null,
    request: async () => true,
    confirm: async () => null,
    cancel: jest.fn(),
  }),
}));
jest.mock('@/hooks/order/useAssertBasketChannel', () => ({ releaseUncommittedBasketChannelSelection: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ isLoggedInForAnalytics: () => false, trackEvent: jest.fn() }));

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

function FollowUpAndCheckoutSurface({ followUp }: { followUp: ReturnType<typeof useOrderTypeFollowUp> }) {
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
    </>
  );
}

function MenuPageControllerOutsideGuestRuntime() {
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
          <FollowUpAndCheckoutSurface followUp={cartFollowUp} />
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
});
