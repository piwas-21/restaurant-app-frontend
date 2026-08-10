/**
 * paymentService — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * The property worth testing here is not "does it parse a boolean". It is that
 * `getOnlinePaymentAvailability` **fails closed**, because every other module signal in this
 * app fails OPEN: `getTenantModules` returns the full module set on error, and the backend's
 * own `TenantModules` reads an absent list as unrestricted. A checkout page that guessed "yes"
 * would offer a diner a payment method the restaurant cannot take.
 *
 * Note what a wrong answer costs in each direction. A wrong `false` hides an option the tenant
 * paid for — visible, reported, fixed. A wrong `true` sends a diner to a redirect that cannot
 * be minted, mid-checkout, after they have chosen to pay. The tests are asymmetric on purpose.
 */

import { getOnlinePaymentAvailability, createCheckoutSession } from './paymentService';
import { apiClient, ApiError } from '@/utils/apiClient';

// Mock the HTTP surface only — a bare `jest.mock('@/utils/apiClient')` automocks the module and
// replaces `ApiError`'s constructor with a no-op, so `rejects.toThrow` reports "did not throw".
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('getOnlinePaymentAvailability', () => {
  // Spied at the top level so the deliberate diagnostic below never prints into a CI log. The
  // nested block re-spies to ASSERT on it; this one only keeps the others quiet.
  let quietWarn: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    quietWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => quietWarn.mockRestore());

  it('is true only when the server says available', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: { available: true } });

    await expect(getOnlinePaymentAvailability()).resolves.toBe(true);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/payments/availability', { requireAuth: false });
  });

  it('is false when the server says unavailable', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: { available: false } });

    await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
  });

  it.each([
    // The tenant did not buy the module — the class-level gate refuses. Normal operation on the
    // whole fleet today, not a fault.
    [
      'a module-gate 404',
      new ApiError(404, 'This feature is not enabled for this restaurant.', [], 'ModuleNotEnabled'),
    ],
    // A tenant still running a backend from before this slice: the route does not exist. Reads
    // identically to the above, and must.
    // PRODUCER-ACCURATE, and this is not a detail. `apiClient` calls `response.json()` BEFORE it
    // checks `response.ok`, so a route-not-found 404 with an EMPTY body (a backend older than
    // this slice) surfaces as ApiError(500, '') — never as ApiError(404, 'Not Found'), which is
    // what an earlier version of this file hand-built. A dead network is ApiError(0, '') for the
    // same reason, not a TypeError.
    [
      'a routing 404 from an older backend',
      new ApiError(500, '', undefined, undefined, { cause: new SyntaxError('Unexpected end of JSON input') }),
    ],
    ['a server error', new ApiError(500, 'Internal Server Error')],
    ['a dead network', new ApiError(0, '')],
    ['a transient token refresh', new ApiError(429, '')],
  ])('is false on %s', async (_label, error) => {
    mockApiClient.get.mockRejectedValue(error);

    await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
  });

  it.each([
    ['an envelope with no data', { success: true }],
    ['a data object with no flag', { success: true, data: {} }],
    // `=== true` rather than truthiness: a stringly-typed body must not read as yes.
    ['a stringly-typed flag', { success: true, data: { available: 'true' } }],
  ])('is false on %s', async (_label, body) => {
    mockApiClient.get.mockResolvedValue(body);

    await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
  });

  describe('what it says about WHY it answered no', () => {
    // Same answer, different diagnosis. A 404 is the answer itself and is the universal case
    // across the fleet, so it must stay silent; anything else means a tenant paying for this
    // module silently stopped being offered it, and silence there is how that goes unnoticed.
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it.each([
      // Carries a body (NotFoundObjectResult + ApiResponse), so it really is a 404 here.
      ['a module-gate 404', new ApiError(404, 'This feature is not enabled for this restaurant.')],
      // The one that matters: EMPTY body, so apiClient reports it as a 500 with no message. This
      // is the universal case across the fleet until the backend half ships, and a status-based
      // test would have warned on every checkout page load.
      [
        'a routing 404 from an older backend',
        new ApiError(500, '', undefined, undefined, { cause: new SyntaxError('Unexpected end of JSON input') }),
      ],
      ['a dead network', new ApiError(0, '')],
    ])('stays silent on %s', async (_label, error) => {
      mockApiClient.get.mockRejectedValue(error);

      await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      // The server answered in its OWN words — a real fault, and the case worth seeing: a tenant
      // paying for this module has silently stopped being offered it.
      ['a server error with a body', new ApiError(500, 'Internal Server Error')],
      ['a refusal with a body', new ApiError(400, 'Something is wrong with this instance')],
    ])('warns on %s', async (_label, error) => {
      mockApiClient.get.mockRejectedValue(error);

      await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  it('never rejects, whatever the transport does', async () => {
    mockApiClient.get.mockRejectedValue(new Error('anything at all'));

    // The caller is a render-time hook with no error path. A rejection here would surface as an
    // unhandled promise on every checkout page load across the fleet.
    await expect(getOnlinePaymentAvailability()).resolves.toBe(false);
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => jest.clearAllMocks());

  const session = {
    sessionId: 'cs_test_1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    expiresAt: '2026-08-10T12:31:00Z',
    currency: 'chf',
    amountMinor: 1690,
  };

  it('posts the order id and returns the session', async () => {
    mockApiClient.post.mockResolvedValue({ success: true, data: session });

    await expect(createCheckoutSession('order-1')).resolves.toEqual(session);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/payments/checkout-session',
      { orderId: 'order-1' },
      { requireAuth: false },
    );
  });

  it('throws the SERVER’s sentence for a 200-wrapped refusal, not the wrapper', async () => {
    // The controller returns Ok(...) whatever ApiResponse.Success says, and the one-argument
    // Failure overload leaves `message` at the literal "Operation failed" while the real reason
    // sits in errors[0]. Reading `message` would show a diner that wrapper (#435).
    mockApiClient.post.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['This order has already been partly or fully paid. Please settle it at the restaurant.'],
    });

    await expect(createCheckoutSession('order-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      errors: ['This order has already been partly or fully paid. Please settle it at the restaurant.'],
    });
  });

  it('refuses a success envelope carrying no session', async () => {
    // Redirecting to `undefined.url` would navigate the diner to a broken page mid-checkout.
    mockApiClient.post.mockResolvedValue({ success: true });

    await expect(createCheckoutSession('order-1')).rejects.toThrow();
  });

  it('does NOT swallow failures — unlike the availability call', async () => {
    mockApiClient.post.mockRejectedValue(new ApiError(500, 'Internal Server Error'));

    await expect(createCheckoutSession('order-1')).rejects.toThrow();
  });
});
