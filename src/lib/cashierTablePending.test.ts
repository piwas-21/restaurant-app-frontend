import { PaymentMethod } from '@/types/order';
import {
  clearPendingTableOperation,
  persistPendingTableClose,
  persistPendingTablePayment,
  readPendingTableOperation,
} from './cashierTablePending';

beforeEach(() => window.sessionStorage.clear());

describe('pending table operation storage', () => {
  it('restores a payment as unknown without replaying it', () => {
    persistPendingTablePayment('session-1', {
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 3,
      paymentMethod: PaymentMethod.Cash,
      amount: 12,
      currency: 'EUR',
    });
    expect(readPendingTableOperation('session-1')).toEqual(
      expect.objectContaining({
        kind: 'payment',
        status: 'Unknown',
        operationId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(readPendingTableOperation('session-2')).toBeNull();
  });

  it('keeps close version state and clears only the matching operation', () => {
    persistPendingTableClose('session-1', 8);
    expect(readPendingTableOperation('session-1')).toEqual(
      expect.objectContaining({ kind: 'close', expectedVersion: 8, status: 'Unknown' }),
    );
    clearPendingTableOperation('session-1', 'different-operation');
    expect(readPendingTableOperation('session-1')).not.toBeNull();
    clearPendingTableOperation('session-1');
    expect(readPendingTableOperation('session-1')).toBeNull();
  });
});
