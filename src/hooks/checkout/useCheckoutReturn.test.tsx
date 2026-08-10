/**
 * useCheckoutReturn — SOFRA-PAYMENTS-PLAN §5 S9, the return trip from Stripe.
 *
 * Two properties carry this file, and both are about NOT overclaiming.
 *
 * The outcome defaults to *pending*, never *paid*. Telling a diner "your order is confirmed" when
 * the money never arrived is the one error here with no recovery: they stop watching, and nobody
 * finds out until the kitchen does not cook. So any status this code has not seen — and both
 * Stripe and the backend add states over time — must land on the cautious sentence.
 *
 * And the cart is cleared ONLY on a real payment. S8 kept it through the whole redirect so an
 * abandoning diner comes back to a page that works; emptying it at the moment we tell them the
 * payment failed would take away the one thing that lets them try again.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { useCheckoutReturn } from './useCheckoutReturn';
import { getCheckoutStatus } from '@/services/paymentService';
import { forgetUnpaidOnlineOrder } from '@/lib/checkout/unpaidOnlineOrder';

const mockClearCart = jest.fn().mockResolvedValue(undefined);
const mockClearCheckout = jest.fn();
const mockClearOrderType = jest.fn();

jest.mock('@/services/paymentService', () => ({ getCheckoutStatus: jest.fn() }));
jest.mock('@/lib/checkout/unpaidOnlineOrder', () => ({ forgetUnpaidOnlineOrder: jest.fn() }));
jest.mock('@/contexts/CheckoutContext', () => ({ useCheckout: () => ({ clearCheckout: mockClearCheckout }) }));
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: () => ({ clearOrderType: mockClearOrderType }) }));
jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ clearCart: mockClearCart }) }));

const mockStatus = getCheckoutStatus as jest.MockedFunction<typeof getCheckoutStatus>;
const mockForget = forgetUnpaidOnlineOrder as jest.MockedFunction<typeof forgetUnpaidOnlineOrder>;

const settlement = (paymentStatus: string, orderStatus: string) => ({
  orderNumber: 'A-001',
  paymentStatus,
  orderStatus,
});

describe('useCheckoutReturn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing at all without a sessionId', async () => {
    const { result } = renderHook(() => useCheckoutReturn(null));

    expect(result.current.outcome).toBe('none');
    // The settle is a WRITE. An ordinary confirmation visit must not perform it.
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('settles and reports paid, clearing the cart', async () => {
    mockStatus.mockResolvedValue(settlement('Completed', 'Confirmed'));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe('paid'));
    expect(mockStatus).toHaveBeenCalledWith('cs_1');
    expect(mockClearCart).toHaveBeenCalledTimes(1);
    expect(mockClearCheckout).toHaveBeenCalledTimes(1);
    expect(mockClearOrderType).toHaveBeenCalledTimes(1);
    expect(result.current.settlement?.orderNumber).toBe('A-001');
  });

  it('reports a cancelled order and KEEPS the basket', async () => {
    mockStatus.mockResolvedValue(settlement('Pending', 'Cancelled'));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe('cancelled'));
    // The whole point of not clearing: this is the diner's only way to try again.
    expect(mockClearCart).not.toHaveBeenCalled();
    expect(mockClearCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ['a delayed method still clearing', 'Pending', 'Pending'],
    ['a status neither Stripe nor we have seen before', 'SomethingNew', 'SomethingElse'],
    ['a part payment', 'PartiallyPaid', 'Pending'],
    ['a refunded order', 'Refunded', 'Confirmed'],
  ])('defaults to pending, never paid, for %s', async (_label, paymentStatus, orderStatus) => {
    mockStatus.mockResolvedValue(settlement(paymentStatus, orderStatus));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe('pending'));
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it('cancelled wins over a Completed payment status', async () => {
    // A settled-then-cancelled order is not a success story, whatever the money column says —
    // the diner must not be told the order is on its way.
    mockStatus.mockResolvedValue(settlement('Completed', 'Cancelled'));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe('cancelled'));
  });

  it('reports unknown — NOT failed — when the backend cannot be reached', async () => {
    // Money has moved by the time anyone lands here. A backend we cannot reach says nothing about
    // whether it arrived, so claiming failure would be as wrong as claiming success.
    mockStatus.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe('unknown'));
    expect(mockClearCart).not.toHaveBeenCalled();
    // Nothing is remembered either — we cannot say the order is reusable.
    expect(mockForget).not.toHaveBeenCalled();
  });

  it.each([
    ['paid', 'Completed', 'Confirmed'],
    ['cancelled', 'Pending', 'Cancelled'],
    ['pending', 'Pending', 'Pending'],
  ])('forgets the remembered unpaid order on %s', async (expected, paymentStatus, orderStatus) => {
    // Whatever the outcome, this order is over. Leaving the id means the diner's NEXT order on the
    // same tab re-uses a paid or cancelled one and meets a refusal they cannot act on (§6d).
    mockStatus.mockResolvedValue(settlement(paymentStatus, orderStatus));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'));

    await waitFor(() => expect(result.current.outcome).toBe(expected));
    expect(mockForget).toHaveBeenCalledTimes(1);
  });

  it('settles once, even under StrictMode double-invoke', async () => {
    // The effect SETTLES A PAYMENT and clears the cart. The server call is idempotent, but two
    // clears race each other's request.
    mockStatus.mockResolvedValue(settlement('Completed', 'Confirmed'));

    const { result } = renderHook(() => useCheckoutReturn('cs_1'), {
      wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
    });

    await waitFor(() => expect(result.current.outcome).toBe('paid'));
    expect(mockStatus).toHaveBeenCalledTimes(1);
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it('does not touch state after unmount', async () => {
    // /checkout/confirmation can redirect out from under this, and the settle is a network round
    // trip. React logs an error on a post-unmount setState; assert none was logged.
    const error = console.error as jest.Mock;
    let resolve: (value: { orderNumber: string; paymentStatus: string; orderStatus: string }) => void = () => {};
    mockStatus.mockReturnValue(new Promise((r) => (resolve = r)));

    const { unmount } = renderHook(() => useCheckoutReturn('cs_1'));
    unmount();
    await act(async () => {
      resolve(settlement('Completed', 'Confirmed'));
    });

    expect(error).not.toHaveBeenCalled();
  });

  it('does not touch state after unmount when the settle FAILS either', async () => {
    const error = console.error as jest.Mock;
    let reject: (reason: Error) => void = () => {};
    mockStatus.mockReturnValue(new Promise((_resolve, r) => (reject = r)));

    const { unmount } = renderHook(() => useCheckoutReturn('cs_1'));
    unmount();
    await act(async () => {
      reject(new Error('network'));
    });

    // console.error IS called by the hook's own diagnostic, so assert on React's complaint shape
    // rather than on it having been called at all.
    const reactWarnings = error.mock.calls.filter((call) => String(call[0]).includes('unmounted'));
    expect(reactWarnings).toHaveLength(0);
  });

  it('does not re-settle on a re-render', async () => {
    mockStatus.mockResolvedValue(settlement('Completed', 'Confirmed'));

    const { result, rerender } = renderHook(() => useCheckoutReturn('cs_1'));
    await waitFor(() => expect(result.current.outcome).toBe('paid'));
    rerender();
    rerender();

    expect(mockStatus).toHaveBeenCalledTimes(1);
  });
});
