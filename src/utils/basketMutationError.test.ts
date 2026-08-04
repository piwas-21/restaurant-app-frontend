import { ApiError } from '@/utils/apiClient';
import { isBasketGone, isBasketItemAlreadyGone, isServerFault } from './basketMutationError';

/**
 * The predicates exist to separate two failures that are otherwise identical on the wire, so the
 * cases worth pinning are the ones where the OLD substring test got it wrong: both messages contain
 * "not found", and only the code tells them apart.
 */
describe('basketMutationError', () => {
  const notFound = (message: string, errorCode?: string) => new ApiError(404, message, [message], errorCode);

  it('recognises the item-level code as already-gone', () => {
    const error = notFound('Basket item not found', 'BasketItemNotFound');

    expect(isBasketItemAlreadyGone(error)).toBe(true);
    expect(isBasketGone(error)).toBe(false);
  });

  it('recognises the basket-level code as a real failure, NOT as already-gone', () => {
    const error = notFound('Basket not found', 'BasketNotFound');

    // The whole point of #415: this must not take the silent-resync branch.
    expect(isBasketItemAlreadyGone(error)).toBe(false);
    expect(isBasketGone(error)).toBe(true);
  });

  it('ignores the message entirely — a basket-level message under the item code is the code', () => {
    // Not a real backend response. It pins that the MESSAGE has no vote: were either predicate
    // still reading it, this pair would come out the other way round.
    expect(isBasketItemAlreadyGone(notFound('Basket not found', 'BasketItemNotFound'))).toBe(true);
    expect(isBasketGone(notFound('Basket item not found', 'BasketNotFound'))).toBe(true);
  });

  it('treats an UNCODED 404 as neither — the fail-safe is to report, not to resync', () => {
    // What a backend that predates the codes answers. Both false means the caller reports the
    // failure, which is the safe half: reporting a benign resync is a cosmetic annoyance, while
    // resyncing a real failure empties the cart.
    const error = notFound('Basket not found');

    expect(isBasketItemAlreadyGone(error)).toBe(false);
    expect(isBasketGone(error)).toBe(false);
  });

  it('treats a non-ApiError as neither', () => {
    // `basketService` throws a plain Error when the backend answers 200 + success:false.
    expect(isBasketItemAlreadyGone(new Error('Failed to remove item from basket'))).toBe(false);
    expect(isBasketGone(new Error('Failed to remove item from basket'))).toBe(false);
    expect(isBasketItemAlreadyGone(undefined)).toBe(false);
    expect(isBasketGone(null)).toBe(false);
  });

  it('does not match a DIFFERENT error code', () => {
    expect(isBasketItemAlreadyGone(notFound('Nope', 'ModuleNotEnabled'))).toBe(false);
    expect(isBasketGone(notFound('Nope', 'ModuleNotEnabled'))).toBe(false);
  });

  describe('isServerFault', () => {
    it('is true for 5xx, which must never render the server’s words', () => {
      expect(isServerFault(new ApiError(500, 'An error occurred while processing your request'))).toBe(true);
      expect(isServerFault(new ApiError(502, ''))).toBe(true);
    });

    it('is false for 4xx and for a non-ApiError', () => {
      // 4xx prose is often written FOR the guest (the channel guard's reason), so it still shows.
      expect(isServerFault(notFound('Basket not found', 'BasketNotFound'))).toBe(false);
      expect(isServerFault(new ApiError(400, 'Dürüm is not available for DineIn.'))).toBe(false);
      expect(isServerFault(new Error('boom'))).toBe(false);
    });

    it('is true for the Development stack-trace shape', () => {
      // The middleware puts `exception.ToString()` into errors[0] on a Development build, and
      // `getErrorMessage` PREFERS errors[0] over message — so without this the cart renders it.
      const trace = 'System.NullReferenceException: Object reference not set...\n   at Basket...';
      expect(isServerFault(new ApiError(500, 'An error occurred', [trace]))).toBe(true);
    });
  });
});
