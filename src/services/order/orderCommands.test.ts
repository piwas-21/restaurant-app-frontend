/**
 * The PRODUCER half of #435.
 *
 * `orderErrorHandler` could be given perfect tests and the customer would still have read
 * "An unexpected error occurred", because the defect was upstream: `createOrderFromBasket` threw
 * `new Error(response.message || …)` for a refusal that arrives INSIDE a 200. Two independent
 * losses in that one line — the reason lives in `errors[0]`, not `message` (which
 * `ApiResponse.Failure` leaves at the literal "Operation failed"), and a plain `Error` is not an
 * `ApiError`, so `getErrorMessage` returns null for it by design.
 *
 * So this file asserts the throw SHAPE, not just that it rejects. A test that only checked
 * "rejects" passed throughout the defect's whole life.
 */

import { apiClient, ApiError, getErrorMessage } from '@/utils/apiClient';
import { createOrder, createOrderFromBasket } from './orderCommands';
import type { CreateOrderCommand, CreateOrderFromBasketCommand } from '@/types/order';

// Stub only the HTTP surface — `throwServerRefusal` builds a real `ApiError` and `getErrorMessage`
// reads it back through `instanceof`, so both must be the genuine implementations.
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

/** The one refusal `CreateOrderCommandHandler` authors inside a 200 on this path. */
const DELIVERY_REASON = 'Delivery address is required for delivery orders';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function captureFailure(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to reject, and it resolved');
}

/** Exactly what the backend puts on the wire for `ApiResponse.Failure(reason)` inside an `Ok(...)`. */
const refusalEnvelope = (reason: string) => ({
  success: false,
  message: 'Operation failed',
  errors: [reason],
  data: null,
});

describe('createOrderFromBasket', () => {
  it('rethrows a 200-wrapped refusal as an ApiError carrying the reason from errors[]', async () => {
    mockPost.mockResolvedValue(refusalEnvelope(DELIVERY_REASON));

    const error = await captureFailure(() => createOrderFromBasket({} as CreateOrderFromBasketCommand));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errors).toEqual([DELIVERY_REASON]);
    // The end-to-end assertion: what a caller's catch can actually read. Before the fix this was
    // null, which is what made every downstream substring match structurally impossible.
    expect(getErrorMessage(error)).toBe(DELIVERY_REASON);
  });

  // Deliberately NOT the empty-basket message: that one THROWS `BadRequestException` server-side
  // and arrives as a genuine 400, so it would prove nothing about the 200-envelope path.
  it('keeps the transport status, rather than inventing a 400 for a refusal that arrived as 200', async () => {
    mockPost.mockResolvedValue(refusalEnvelope(DELIVERY_REASON));

    const error = await captureFailure(() => createOrderFromBasket({} as CreateOrderFromBasketCommand));

    expect((error as ApiError).status).toBe(200);
  });

  it('passes a successful order straight through', async () => {
    mockPost.mockResolvedValue({ success: true, data: { id: 'o1', orderNumber: 'A-1' } });

    await expect(createOrderFromBasket({} as CreateOrderFromBasketCommand)).resolves.toEqual({
      id: 'o1',
      orderNumber: 'A-1',
    });
  });

  // A 200 whose `success` is true but whose `data` is missing is not a success — returning it would
  // hand the caller `undefined` and blow up on `createdOrder.orderNumber` one line later.
  it('rejects a success envelope with no data', async () => {
    mockPost.mockResolvedValue({ success: true, data: null });

    const error = await captureFailure(() => createOrderFromBasket({} as CreateOrderFromBasketCommand));

    expect(error).toBeInstanceOf(ApiError);
    // `toBeInstanceOf` alone also passes under a hollowed-out automock. This pins the shape: the
    // envelope carried no reason, so there is nothing for a caller to render.
    expect(getErrorMessage(error)).toBeNull();
  });
});

describe('createOrder', () => {
  // Same shape, same loss: a refusal with `data: null` threw a client-authored
  // 'Failed to create order'. Covered even though `createOrder` currently has NO caller (it is
  // reachable only via the `orderService` barrel) — the export is public, and leaving one of two
  // sibling creators on the broken shape is how the pair drifts apart again.
  it('rethrows a 200-wrapped refusal as an ApiError carrying the reason', async () => {
    mockPost.mockResolvedValue(refusalEnvelope(DELIVERY_REASON));

    const error = await captureFailure(() => createOrder({} as CreateOrderCommand));

    expect(error).toBeInstanceOf(ApiError);
    expect(getErrorMessage(error)).toBe(DELIVERY_REASON);
  });
});
