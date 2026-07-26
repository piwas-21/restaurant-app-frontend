import { getAddToCartErrorMessage } from './addToCartError';
import { ApiError } from '@/utils/apiClient';
import type { TFunction } from 'i18next';

// Mirrors the i18next contract closely enough for this util: it only ever calls `t(key)`.
const t = ((key: string) => `translated:${key}`) as unknown as TFunction;

const CHANNEL_BLOCK = 'Dürüm is not available for DineIn. Available for: Takeaway, Delivery.';

const blocked = (message = CHANNEL_BLOCK, errors?: string[]) =>
  new ApiError(400, message, errors, 'OrderTypeNotAvailable');

describe('getAddToCartErrorMessage', () => {
  it('passes the server reason through when the code says it is the channel guard', () => {
    expect(getAddToCartErrorMessage(blocked(), t)).toBe(CHANNEL_BLOCK);
  });

  // The reason the gate is the CODE and not the status: `POST /api/Basket/items` answers 400/404
  // for plenty of things whose message is not fit to render.
  it.each([
    ['the generic wrapper on a controller-level failure', new ApiError(400, 'Operation failed')],
    ['the FluentValidation wrapper', new ApiError(400, 'Validation failed')],
    ['a session-plumbing message', new ApiError(400, 'Session ID is required')],
    ['a raw id in a not-found', new ApiError(404, 'Child product not found: 3f2a1b4c-0000-0000-0000-000000000000')],
    ['an internal 500', new ApiError(500, 'Object reference not set to an instance')],
    ['our own synthesized network error', new ApiError(0, 'Network error. Please check your internet connection.')],
  ])('falls back for %s', (_label, error) => {
    expect(getAddToCartErrorMessage(error, t)).toBe('translated:error_adding_to_cart');
  });

  it('falls back for a plain Error, a string and null', () => {
    expect(getAddToCartErrorMessage(new Error('boom'), t)).toBe('translated:error_adding_to_cart');
    expect(getAddToCartErrorMessage('boom', t)).toBe('translated:error_adding_to_cart');
    expect(getAddToCartErrorMessage(null, t)).toBe('translated:error_adding_to_cart');
  });

  it('falls back when the coded error somehow carries a blank message', () => {
    expect(getAddToCartErrorMessage(blocked('   '), t)).toBe('translated:error_adding_to_cart');
  });

  it('honours a caller-supplied fallback key, but never over a coded reason', () => {
    expect(getAddToCartErrorMessage(new Error('boom'), t, 'error_loading_product')).toBe(
      'translated:error_loading_product',
    );
    expect(getAddToCartErrorMessage(blocked(), t, 'error_loading_product')).toBe(CHANNEL_BLOCK);
  });

  it('reads `message`, not `errors` — the middleware fills `errors` with a stack trace in Development', () => {
    const devShaped = blocked(CHANNEL_BLOCK, [
      'RestaurantSystem.Api.Common.Exceptions.BadRequestException: ...\n   at ...',
    ]);

    expect(getAddToCartErrorMessage(devShaped, t)).toBe(CHANNEL_BLOCK);
  });
});
