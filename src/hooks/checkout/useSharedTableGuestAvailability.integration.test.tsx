import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckoutTableGuestStateProvider } from '@/contexts/CheckoutTableGuestStateContext';
import { TableGuestVisitContext, type TableGuestVisitContextValue } from '@/contexts/TableGuestVisitContext';
import { OrderType } from '@/types/order';
import { useEnabledOrderTypes } from './useEnabledOrderTypes';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import { useSmartCheckoutRouter } from './useSmartCheckoutRouter';

const mockGetEnabled = jest.fn<Promise<OrderType[]>, []>();
const mockPush = jest.fn();
const mockSetOrderType = jest.fn((type: OrderType) => {
  mockOrderTypeState.orderType = type;
});
const mockSetTable = jest.fn();
const mockOrderTypeState = { orderType: null as OrderType | null, table: '' };
const mockTableContext = {
  hasTableContext: true,
  tableContext: { tableId: 'table-11', tableNumber: '11a', dineInPinned: true },
  setTableContext: jest.fn(),
};

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: () => mockGetEnabled() },
}));
jest.mock('@/services/tableGuestVisitStorage', () => ({ hasStoredTableGuestState: () => false }));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState, setOrderType: mockSetOrderType, setTable: mockSetTable }),
}));
jest.mock('@/contexts/TableContext', () => ({ useTableContext: () => mockTableContext }));
jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: null, deliveryAddress: null }, setCustomerInfo: jest.fn() }),
}));
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

const activeVisit: TableGuestVisitContextValue = {
  phase: 'active',
  visit: {
    serviceSessionId: 'session-1',
    participantToken: 'participant-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
    tableId: 'table-11',
  },
  featureEnabled: true,
  featureStatus: 'ready',
  pendingRound: null,
  pendingRoundStatus: 'known',
  requiresSafeDeparture: false,
  lastRoundAcknowledgement: null,
  joinVisit: async () => activeVisit.visit!,
  getAccount: async () => {
    throw new Error('not used');
  },
  createRound: async () => {
    throw new Error('not used');
  },
  savePendingRound: () => true,
  clearPendingRound: jest.fn(),
  markVisitUnavailable: jest.fn(),
  leaveAfterSafeDeparture: () => false,
  recordRoundAcknowledgement: jest.fn(),
};

function RetrySurface() {
  const tableGuest = useTableGuestDineInAvailability();
  const orderTypes = useEnabledOrderTypes();
  return (
    <>
      <p data-testid="retry-surface-state">{tableGuest.dineInAvailable ? 'available' : 'blocked'}</p>
      <p data-testid="public-read-state">
        {orderTypes.loading
          ? 'loading'
          : orderTypes.confirmed && orderTypes.enabled.includes(OrderType.DineIn)
            ? 'available'
            : 'closed'}
      </p>
      <button type="button" onClick={() => void tableGuest.refreshDineInAvailability()}>
        Retry availability
      </button>
    </>
  );
}

function FollowUpAndCheckoutSurface() {
  const followUp = useOrderTypeFollowUp();
  const checkout = useSmartCheckoutRouter();
  const tableGuest = useTableGuestDineInAvailability();
  const [checkoutResult, setCheckoutResult] = useState('not attempted');

  return (
    <>
      <p data-testid="checkout-surface-state">{tableGuest.dineInAvailable ? 'available' : 'blocked'}</p>
      <p data-testid="follow-up-state">{followUp.followUp ?? 'none'}</p>
      <button
        type="button"
        onClick={async () => {
          const result = await checkout.proceedToCheckout(OrderType.DineIn);
          setCheckoutResult(result ?? 'routed');
        }}
      >
        Continue to checkout
      </button>
      <p data-testid="checkout-result">{checkoutResult}</p>
    </>
  );
}

describe('shared table guest Dine-In availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderTypeState.orderType = null;
    mockOrderTypeState.table = '';
    mockGetEnabled.mockReset();
    mockGetEnabled
      .mockResolvedValueOnce([OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.DineIn, OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.Takeaway]);
  });

  it('unblocks every mounted consumer after one retry and restores the pinned table visit', async () => {
    render(
      <TableGuestVisitContext.Provider value={activeVisit}>
        <CheckoutTableGuestStateProvider value={{ phase: 'active', hasPendingRound: false, hasAcknowledgement: false }}>
          <RetrySurface />
          <FollowUpAndCheckoutSurface />
        </CheckoutTableGuestStateProvider>
      </TableGuestVisitContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('retry-surface-state')).toHaveTextContent('blocked'));
    await waitFor(() => expect(screen.getByTestId('public-read-state')).toHaveTextContent('closed'));
    expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('blocked');
    expect(screen.getByTestId('follow-up-state')).toHaveTextContent('none');
    expect(mockGetEnabled).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry availability' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('retry-surface-state')).toHaveTextContent('available');
      expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('available');
      expect(screen.getByTestId('follow-up-state')).toHaveTextContent('none');
      expect(mockSetOrderType).toHaveBeenCalledWith(OrderType.DineIn);
      expect(mockSetTable).toHaveBeenCalledWith('11a');
    });
    expect(mockGetEnabled).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    await waitFor(() => expect(screen.getByTestId('checkout-result')).toHaveTextContent('routed'));
    expect(mockPush).toHaveBeenCalledWith('/checkout/review');

    await act(async () => {
      fireEvent.focus(window);
    });
    await waitFor(() => {
      expect(screen.getByTestId('public-read-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('checkout-surface-state')).toHaveTextContent('blocked');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    await waitFor(() => expect(screen.getByTestId('checkout-result')).toHaveTextContent('table-guest-unavailable'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockGetEnabled).toHaveBeenCalledTimes(3);
  });
});
