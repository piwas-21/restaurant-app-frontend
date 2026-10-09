import { ApiError } from '@/utils/apiClient';

export type GuestPaymentErrorKey = '' | 'load' | 'action';

/** Reduce failures to localized UI states; never expose provider or server prose. */
export function guestPaymentErrorMessage(
  error: unknown,
  fallback: Exclude<GuestPaymentErrorKey, ''>,
): GuestPaymentErrorKey {
  return error instanceof ApiError && error.status >= 500 ? 'load' : fallback;
}
