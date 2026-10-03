import { ApiError } from '@/utils/apiClient';
import { guestPaymentErrorMessage } from './guestPaymentError';

describe('guestPaymentErrorMessage', () => {
  it('maps server errors to the localized load state', () => {
    expect(guestPaymentErrorMessage(new ApiError(500, 'private provider detail'), 'action')).toBe('load');
  });

  it.each([400, 403])('uses the safe fallback for HTTP %i', (status) => {
    expect(guestPaymentErrorMessage(new ApiError(status, 'private account detail'), 'action')).toBe('action');
  });

  it('does not expose private exception text', () => {
    expect(guestPaymentErrorMessage(new Error('private provider token'), 'load')).toBe('load');
  });
});
