/**
 * useOnlineCheckout — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * Every test here is about the SECOND press of Place Order. The first press is uninteresting:
 * create an order, mint a session, leave for Stripe. What the hook exists to get right is what
 * happens when something fails in between — because the naive version creates a second order
 * every time, and each one carries its own `Processing` tender that nothing clears until the S7
 * expiry sweep runs half an hour later.
 *
 * Three of these cases came out of review rather than out of writing the hook, and each is one
 * where the obvious implementation is wrong in the expensive direction: 429, a changed command,
 * and a press that arrives after the browser has been to Stripe and back.
 */

import { renderHook, act } from '@testing-library/react';
import { useOnlineCheckout } from './useOnlineCheckout';
import { createOrderFromBasket } from '@/services/orderService';
import { createCheckoutSession } from '@/services/paymentService';
import { ApiError } from '@/utils/apiClient';
import { navigateExternal } from '@/lib/navigateExternal';
import type { CreateOrderFromBasketCommand } from '@/types/order';

jest.mock('@/services/orderService', () => ({ createOrderFromBasket: jest.fn() }));
jest.mock('@/services/paymentService', () => ({ createCheckoutSession: jest.fn() }));
jest.mock('@/lib/navigateExternal', () => ({ navigateExternal: jest.fn() }));

const mockCreateOrder = createOrderFromBasket as jest.MockedFunction<typeof createOrderFromBasket>;
const mockCreateSession = createCheckoutSession as jest.MockedFunction<typeof createCheckoutSession>;
const mockNavigate = navigateExternal as jest.MockedFunction<typeof navigateExternal>;

const command = {
  customerName: 'A',
  payments: [{ paymentMethod: 'OnlinePayment', amount: 16.9 }],
} as unknown as CreateOrderFromBasketCommand;

/** The same order with a tip added — what the diner can build after a failed attempt. */
const commandWithTip = {
  customerName: 'A',
  payments: [{ paymentMethod: 'OnlinePayment', amount: 18.6 }],
} as unknown as CreateOrderFromBasketCommand;

const session = {
  sessionId: 'cs_1',
  url: 'https://checkout.stripe.com/c/pay/cs_1',
  expiresAt: '2026-08-10T12:31:00Z',
  currency: 'chf',
  amountMinor: 1690,
};

type Rendered = { current: { payOnline: (c: CreateOrderFromBasketCommand) => Promise<void> } };

async function press(result: Rendered, c: CreateOrderFromBasketCommand = command) {
  await act(() => result.current.payOnline(c));
}

async function pressExpectingFailure(result: Rendered, c: CreateOrderFromBasketCommand = command) {
  await act(async () => {
    await expect(result.current.payOnline(c)).rejects.toThrow();
  });
}

describe('useOnlineCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockCreateOrder.mockResolvedValue({ id: 'order-1', orderNumber: 'A-001' } as never);
  });

  it('creates the order, mints the session, and leaves for Stripe', async () => {
    mockCreateSession.mockResolvedValue(session);
    const { result } = renderHook(() => useOnlineCheckout());

    await press(result);

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledWith('order-1');
    // A full navigation, not router.push: Stripe is another origin.
    expect(mockNavigate).toHaveBeenCalledWith(session.url);
  });

  describe('a failure the order can survive — the retry must RE-USE it', () => {
    it.each([
      ['a 5xx', new ApiError(500, 'Internal Server Error')],
      ['a dead network', new ApiError(0, '')],
      // THE case review caught. `checkout-session` is rate-limited (10 per 15 min, partitioned by
      // IP) while order CREATION is not, and a dine-in room shares one public IP over the venue
      // Wi-Fi. A `>= 400 && < 500` range test classified this as permanent, so every press minted
      // another order with its own Processing tender — the exact inverse of this hook's purpose.
      ['a rate-limit 429', new ApiError(429, 'Too many requests. Please slow down and try again shortly.')],
      ['a transient token refresh', new ApiError(429, '')],
      ['a timeout', new ApiError(408, 'Request Timeout')],
    ])('re-uses the order after %s', async (_label, error) => {
      mockCreateSession.mockRejectedValueOnce(error);
      mockCreateSession.mockResolvedValueOnce(session);
      const { result } = renderHook(() => useOnlineCheckout());

      await pressExpectingFailure(result);
      await press(result);

      expect(mockCreateOrder).toHaveBeenCalledTimes(1);
      expect(mockCreateSession).toHaveBeenNthCalledWith(2, 'order-1');
    });
  });

  describe('a refusal the order can NEVER recover from — the retry must start fresh', () => {
    it.each([
      // The S7 expiry sweep cancelled the order while the diner sat on this page.
      ['a 400 refusal', new ApiError(400, 'This order is closed and can no longer be paid online.')],
      ['a 200-wrapped refusal', new ApiError(200, 'Operation failed', ['This order is closed.'])],
      ['a 404', new ApiError(404, 'Order not found')],
      ['a 409', new ApiError(409, 'Conflict')],
    ])('starts a fresh order after %s', async (_label, error) => {
      mockCreateSession.mockRejectedValueOnce(error);
      mockCreateSession.mockResolvedValueOnce(session);
      mockCreateOrder.mockResolvedValueOnce({ id: 'order-1', orderNumber: 'A-001' } as never);
      mockCreateOrder.mockResolvedValueOnce({ id: 'order-2', orderNumber: 'A-002' } as never);
      const { result } = renderHook(() => useOnlineCheckout());

      await pressExpectingFailure(result);
      await press(result);

      // Retrying the dead id would refuse forever and strand the diner on a page with no way out.
      expect(mockCreateOrder).toHaveBeenCalledTimes(2);
      expect(mockCreateSession).toHaveBeenNthCalledWith(2, 'order-2');
    });
  });

  it('does NOT re-use the order when the diner changed the total in between', async () => {
    // The page is fully interactive after a failure, so a tip or a points redemption can land
    // between attempts. Stripe charges the PERSISTED order.Total (server-authoritative, S0b), so
    // re-using order-1 would charge the old figure while the summary on screen showed the new one.
    mockCreateSession.mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'));
    mockCreateSession.mockResolvedValueOnce(session);
    mockCreateOrder.mockResolvedValueOnce({ id: 'order-1', orderNumber: 'A-001' } as never);
    mockCreateOrder.mockResolvedValueOnce({ id: 'order-2', orderNumber: 'A-002' } as never);
    const { result } = renderHook(() => useOnlineCheckout());

    await pressExpectingFailure(result, command);
    await press(result, commandWithTip);

    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    expect(mockCreateSession).toHaveBeenNthCalledWith(2, 'order-2');
  });

  it('survives the round trip to Stripe — a press after coming back re-uses the order', async () => {
    // The single most likely second press in the whole design, and an in-memory ref cannot see it:
    // returning from another origin is a document load. With the order forgotten, a diner who
    // already PAID and pressed Back would get a fresh order and a second Stripe page — a second
    // charge, since the backend's EnsurePayable would have refused the first one.
    mockCreateSession.mockResolvedValue(session);
    const first = renderHook(() => useOnlineCheckout());
    await press(first.result);
    first.unmount();

    // A brand-new hook, as after a document load; only sessionStorage carries over.
    const second = renderHook(() => useOnlineCheckout());
    await press(second.result);

    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenNthCalledWith(2, 'order-1');
  });

  it('does not mint a session when the order could not be created', async () => {
    mockCreateOrder.mockRejectedValue(new ApiError(400, 'Delivery address is required'));
    const { result } = renderHook(() => useOnlineCheckout());

    await pressExpectingFailure(result);

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('never navigates on a failure', async () => {
    mockCreateSession.mockRejectedValue(new ApiError(500, 'Internal Server Error'));
    const { result } = renderHook(() => useOnlineCheckout());

    await pressExpectingFailure(result);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
