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
import tableGuestEnglish from '@/locales/table-guest/en.json';

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
  dineInUnavailable: boolean;
  refreshDineInAvailability: () => Promise<boolean>;
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
const channelMismatch = { ...mockBasket, orderType: OrderType.Takeaway };
const noticeSuppressionStates: Array<[string, Partial<CartState>, Partial<typeof mockRound>]> = [
  ['a still-loading basket', { basket: channelMismatch, isLoading: true }, {}],
  ['an in-flight basket update', { basket: channelMismatch, isSyncing: true }, {}],
  ['a basket read error', { basket: channelMismatch, error: 'basket read failed' }, {}],
  ['a basket without a completed sync', { basket: channelMismatch, lastSyncedAt: null }, {}],
  ['a submission error', { basket: channelMismatch }, { error: 'round failed' }],
  [
    'a pending round recovery',
    { basket: channelMismatch },
    {
      pendingRound: {
        serviceSessionId: 'visit-id',
        operationId: 'durable-round',
        expectedAccountRevision: 4,
        expectedBasketFingerprint: 'A'.repeat(64),
      },
    },
  ],
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
    dineInUnavailable: false,
    refreshDineInAvailability: jest.fn().mockResolvedValue(false),
    lastRoundAcknowledgement: null,
    canSubmit: true,
  };
  i18n.addResourceBundle('en', 'translation', tableGuestEnglish, true, true);
});

describe('TableGuestRoundReviewContainer channel readiness', () => {
  it('holds a mismatched canonical basket and explains how to recover', () => {
    mockCartState = stateWith({ basket: { ...mockBasket, orderType: OrderType.Takeaway } });

    renderReview();

    expect(screen.queryByRole('button', { name: i18n.t('table_guest_round_action') })).not.toBeInTheDocument();
    expect(screen.getByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).toBeVisible();
    expect(screen.getByRole('link', { name: i18n.t('table_guest_round_edit') })).toHaveAttribute('href', '/cart');
  });

  it.each(noticeSuppressionStates)('keeps the channel warning out of %s', (_reason, cartOverrides, roundOverrides) => {
    mockCartState = stateWith(cartOverrides);
    mockRound = { ...mockRound, ...roundOverrides };

    renderReview();

    expect(screen.queryByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).not.toBeInTheDocument();
  });

  it('uses a native status output for unavailable dine-in and keeps its retry action', () => {
    const refreshDineInAvailability = jest.fn().mockResolvedValue(true);
    mockRound = { ...mockRound, dineInUnavailable: true, refreshDineInAvailability };

    renderReview();

    const status = screen.getByRole('status');
    expect(status.tagName).toBe('OUTPUT');
    expect(status).toHaveTextContent(i18n.t('table_guest_dine_in_unavailable'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('table_guest_unavailable_retry_action') }));
    expect(refreshDineInAvailability).toHaveBeenCalledTimes(1);
  });

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

  it('shows a refused-channel warning only after the write and canonical read settle', async () => {
    mockCartState = stateWith({ basket: { ...mockBasket, orderType: OrderType.Takeaway } });
    let releaseWrite: ((value: BasketChannelSwitch) => void) | undefined;
    let releaseRead: ((value: boolean) => void) | undefined;
    mockedSetBasketOrderType.mockReturnValueOnce(new Promise((resolve) => (releaseWrite = resolve)));
    mockSyncBasket.mockReturnValueOnce(new Promise((resolve) => (releaseRead = resolve)));

    let mutation: Promise<unknown> | undefined;
    act(() => {
      mutation = setBasketOrderTypeAndRefresh(OrderType.DineIn, mockCartState.basket, mockSyncBasket);
    });
    renderReview();
    expect(screen.queryByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).not.toBeInTheDocument();

    await act(async () => {
      releaseWrite?.(switchReply({ applied: false }));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSyncBasket).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).not.toBeInTheDocument();

    await act(async () => {
      releaseRead?.(true);
      await mutation;
    });
    expect(await screen.findByText(tableGuestEnglish.table_guest_round_channel_unconfirmed)).toBeVisible();
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
