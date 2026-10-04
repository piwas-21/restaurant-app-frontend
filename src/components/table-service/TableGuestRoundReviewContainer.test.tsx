import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { CartState } from '@/components/cart/cartTypes';
import i18n from '../../i18n';
import TableGuestRoundReviewContainer from './TableGuestRoundReviewContainer';
import { setBasketOrderType } from '@/services/basketChannelService';
import { setBasketOrderTypeAndRefresh } from '@/hooks/order/useAssertBasketChannel';
import type { BasketDto } from '@/types/basket';
import type { BasketChannelSwitch } from '@/types/basketChannel';
import type { PendingTableGuestRound } from '@/types/tableGuestVisit';
import { OrderType } from '@/types/order';

jest.mock('@/components/checkout/OrderItemsList', () => ({ __esModule: true, default: () => null }));
jest.mock('next/navigation', () => ({ usePathname: () => '/checkout/review' }));
jest.mock('@/services/basketChannelService', () => ({ setBasketOrderType: jest.fn() }));

const mockSubmit = jest.fn().mockResolvedValue(undefined);
const mockSyncBasket = jest.fn();
const mockClearCart = jest.fn().mockResolvedValue(undefined);
const mockBasketItem = { id: 'basket-line', quantity: 1, unitPrice: 5, itemTotal: 5, specialInstructions: '' };
const mockBasket: BasketDto = {
  id: 'basket-id',
  subTotal: 5,
  tax: 0,
  deliveryFee: 0,
  discount: 0,
  customerDiscount: 0,
  total: 5,
  totalItems: 1,
  orderType: OrderType.DineIn,
  items: [mockBasketItem],
};
let mockCartState: CartState;
let mockSelectedOrderType: OrderType | null;
let mockRound: {
  submit: typeof mockSubmit;
  isSubmitting: boolean;
  error: string;
  pendingRound: PendingTableGuestRound | null;
  pendingRoundUnavailable: boolean;
  lastRoundAcknowledgement: null;
  canSubmit: boolean;
};

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ state: mockCartState, syncBasket: mockSyncBasket, clearCart: mockClearCart }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: mockSelectedOrderType } }),
}));
jest.mock('@/hooks/checkout/useTableGuestRoundSubmission', () => ({
  useTableGuestRoundSubmission: () => mockRound,
}));

const mockedSetBasketOrderType = setBasketOrderType as jest.MockedFunction<typeof setBasketOrderType>;
const notReadyStates: Array<[string, Partial<CartState>]> = [
  ['an unset basket channel', { basket: { ...mockBasket, orderType: null } }],
  ['a still-loading basket', { isLoading: true }],
  ['an in-flight item mutation', { isSyncing: true }],
  ['an optimistic item change', { items: [{ ...mockBasketItem, basketItemId: mockBasketItem.id, quantity: 2 }] }],
  ['a basket without a completed sync', { lastSyncedAt: null }],
];

function stateWith(overrides: Partial<CartState> = {}): CartState {
  return {
    items: [{ ...mockBasketItem, basketItemId: mockBasketItem.id }],
    basket: mockBasket,
    isLoading: false,
    isSyncing: false,
    error: null,
    lastSyncedAt: 100,
    ...overrides,
  };
}

function renderReview(recoveryOnly = false) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TableGuestRoundReviewContainer formatPrice={(amount) => amount.toFixed(2)} recoveryOnly={recoveryOnly} />
    </I18nextProvider>,
  );
}

function switchReply(overrides: Partial<BasketChannelSwitch> = {}): BasketChannelSwitch {
  return { applied: true, conflicts: [], removed: [], basket: mockBasket, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncBasket.mockResolvedValue(true);
  mockCartState = stateWith();
  mockSelectedOrderType = OrderType.DineIn;
  mockRound = {
    submit: mockSubmit,
    isSubmitting: false,
    error: '',
    pendingRound: null,
    pendingRoundUnavailable: false,
    lastRoundAcknowledgement: null,
    canSubmit: true,
  };
});

describe('TableGuestRoundReviewContainer channel readiness', () => {
  it.each(notReadyStates)('does not offer a new round for %s', (_reason, overrides) => {
    mockCartState = stateWith(overrides);
    renderReview();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('waits for the channel mutation and canonical CartContext read before enabling a new round', async () => {
    let releaseWrite: ((value: BasketChannelSwitch) => void) | undefined;
    let releaseRead: ((value: boolean) => void) | undefined;
    mockedSetBasketOrderType.mockReturnValueOnce(new Promise((resolve) => (releaseWrite = resolve)));
    mockSyncBasket.mockReturnValueOnce(new Promise((resolve) => (releaseRead = resolve)));

    let mutation: Promise<unknown> | undefined;
    act(() => {
      mutation = setBasketOrderTypeAndRefresh(OrderType.DineIn, mockBasket, mockSyncBasket);
    });
    renderReview();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await act(async () => {
      releaseWrite?.(switchReply());
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSyncBasket).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    await act(async () => {
      releaseRead?.(true);
      await mutation;
    });
    expect(await screen.findByRole('button')).toBeEnabled();
  });

  it('keeps a persisted round retry available while the current basket cannot be reviewed', () => {
    const pendingRound: PendingTableGuestRound = {
      serviceSessionId: 'visit-id',
      operationId: 'durable-round',
      expectedAccountRevision: 4,
      expectedBasketFingerprint: 'A'.repeat(64),
    };
    mockCartState = stateWith({ basket: null, lastSyncedAt: null, isLoading: true, isSyncing: true, items: [] });
    mockSelectedOrderType = null;
    mockRound = { ...mockRound, pendingRound };

    renderReview(true);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
});
