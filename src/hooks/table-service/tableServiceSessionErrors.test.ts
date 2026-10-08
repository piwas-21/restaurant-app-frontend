import { ApiError } from '@/utils/apiClient';
import { tableServiceCloseErrorMessage } from './tableServiceSessionErrors';

describe('tableServiceCloseErrorMessage', () => {
  it.each([
    ['KitchenWorkUnresolved', 'server.bill.close_blocked_kitchen_work'],
    ['KitchenCorrectionUnresolved', 'server.bill.close_blocked_kitchen_correction'],
  ])('gives the next kitchen action for %s', (errorCode, expectedKey) => {
    expect(tableServiceCloseErrorMessage(new ApiError(409, 'Conflict', undefined, errorCode))).toBe(expectedKey);
  });

  it('keeps the existing generic fallback for other close failures', () => {
    expect(tableServiceCloseErrorMessage(new Error('unexpected'))).toBe('cashier.tables.close_failed');
  });
});
