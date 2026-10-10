import { PaymentMethod } from '@/types/order';
import {
  clearPendingTableOperation,
  persistPendingTableClose,
  persistPendingTablePayment,
  readPendingTableOperation,
} from './cashierTablePending';

beforeEach(() => {
  jest.restoreAllMocks();
  window.sessionStorage.clear();
});

afterEach(() => jest.restoreAllMocks());

describe('pending table operation storage', () => {
  it('restores a payment as unknown without replaying it', () => {
    expect(
      persistPendingTablePayment('session-1', {
        operationId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 3,
        paymentMethod: PaymentMethod.Cash,
        amount: 12,
        tipMinor: 125,
        currency: 'EUR',
      }),
    ).toBe(true);
    expect(readPendingTableOperation('session-1')).toEqual(
      expect.objectContaining({
        kind: 'payment',
        status: 'Unknown',
        operationId: '11111111-1111-4111-8111-111111111111',
        tipMinor: 125,
      }),
    );
    expect(readPendingTableOperation('session-2')).toBeNull();
  });

  it('persists a payment only when the exact journal can be read back', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string) {
      if (this !== window.sessionStorage || key !== 'cashier.pending-table-operation') return;
    });
    expect(
      persistPendingTablePayment('session-1', {
        operationId: '11111111-1111-4111-8111-111111111111',
        expectedVersion: 3,
        paymentMethod: PaymentMethod.Cash,
        amount: 12,
        tipMinor: 125,
      }),
    ).toBe(false);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('fails closed when storage is unavailable or quota-limited', () => {
    const payment = {
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 3,
      paymentMethod: PaymentMethod.Cash,
      amount: 12,
      tipMinor: 125,
    };
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (this === window.sessionStorage && key === 'cashier.pending-table-operation') {
        throw new Error('storage unavailable');
      }
      return null;
    });
    expect(persistPendingTablePayment('session-1', payment)).toBe(false);

    jest.restoreAllMocks();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string) {
      if (this === window.sessionStorage && key === 'cashier.pending-table-operation') {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
    });
    expect(persistPendingTablePayment('session-1', payment)).toBe(false);
  });

  it('does not overwrite a corrupt or different-session journal', () => {
    const payment = {
      operationId: '22222222-2222-4222-8222-222222222222',
      expectedVersion: 4,
      paymentMethod: PaymentMethod.Cash,
      amount: 5,
    };
    const key = 'cashier.pending-table-operation';
    const unrelated = JSON.stringify({
      kind: 'payment',
      serviceSessionId: 'session-2',
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 3,
      paymentMethod: PaymentMethod.Cash,
      amount: 12,
    });

    window.sessionStorage.setItem(key, '{corrupt');
    expect(persistPendingTablePayment('session-1', payment)).toBe(false);
    expect(window.sessionStorage.getItem(key)).toBe('{corrupt');

    window.sessionStorage.setItem(key, unrelated);
    expect(persistPendingTablePayment('session-1', payment)).toBe(false);
    expect(window.sessionStorage.getItem(key)).toBe(unrelated);
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
