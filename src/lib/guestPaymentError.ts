import { getErrorMessage } from '@/utils/apiClient';

/** Keep server-authored payment failures visible while retaining localized fallback keys. */
export function guestPaymentErrorMessage(error: unknown, fallback: 'load' | 'action'): string {
  return getErrorMessage(error) ?? fallback;
}
