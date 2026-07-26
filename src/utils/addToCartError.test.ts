import { getAddToCartErrorMessage } from './addToCartError';
import { ApiError } from '@/utils/apiClient';
import type { TFunction } from 'i18next';

// Mirrors the i18next contract closely enough for this util: it only ever calls `t(key)`.
const t = ((key: string) => `translated:${key}`) as unknown as TFunction;

describe('getAddToCartErrorMessage', () => {
  it('passes the server reason through on a 400 — the whole point of the feature', () => {
    const rejection = new ApiError(400, 'Dürüm is not available for DineIn. Available for: Takeaway, Delivery.');

    expect(getAddToCartErrorMessage(rejection, t)).toBe(
      'Dürüm is not available for DineIn. Available for: Takeaway, Delivery.',
    );
  });

  it('passes a 404 reason through — the product went away between render and tap', () => {
    expect(getAddToCartErrorMessage(new ApiError(404, 'Product not found or unavailable'), t)).toBe(
      'Product not found or unavailable',
    );
  });

  it('falls back for a 5xx, whose message is internal detail', () => {
    expect(getAddToCartErrorMessage(new ApiError(500, 'Object reference not set to an instance'), t)).toBe(
      'translated:error_adding_to_cart',
    );
  });

  it('falls back for the synthesized network error (status 0)', () => {
    expect(getAddToCartErrorMessage(new ApiError(0, 'Network error. Please check your internet connection.'), t)).toBe(
      'translated:error_adding_to_cart',
    );
  });

  it('falls back for a plain Error, a string and null', () => {
    expect(getAddToCartErrorMessage(new Error('boom'), t)).toBe('translated:error_adding_to_cart');
    expect(getAddToCartErrorMessage('boom', t)).toBe('translated:error_adding_to_cart');
    expect(getAddToCartErrorMessage(null, t)).toBe('translated:error_adding_to_cart');
  });

  it('falls back when a guest-facing status carries a blank message', () => {
    expect(getAddToCartErrorMessage(new ApiError(400, '   '), t)).toBe('translated:error_adding_to_cart');
  });

  it('honours a caller-supplied fallback key, but never over a real reason', () => {
    expect(getAddToCartErrorMessage(new Error('boom'), t, 'error_loading_product')).toBe(
      'translated:error_loading_product',
    );
    expect(getAddToCartErrorMessage(new ApiError(400, 'Blocked'), t, 'error_loading_product')).toBe('Blocked');
  });

  it('reads `message`, not `errors` — the backend fills `errors` with a stack trace in Development', () => {
    const devShaped = new ApiError(400, 'Dürüm is not available for DineIn.', [
      'RestaurantSystem.Api.Common.Exceptions.BadRequestException: ...\n   at ...',
    ]);

    expect(getAddToCartErrorMessage(devShaped, t)).toBe('Dürüm is not available for DineIn.');
  });
});
