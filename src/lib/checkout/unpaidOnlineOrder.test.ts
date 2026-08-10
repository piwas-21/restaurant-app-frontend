/**
 * unpaidOnlineOrder — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * `useOnlineCheckout.test.ts` covers the happy paths through this module. What is left, and what
 * this file is for, are the paths where **storage itself refuses**: private browsing, blocked
 * cookies, a full quota, or a value some other tab corrupted. Every one of them must degrade to
 * "no remembered order" — the pre-S8 behaviour — and never to a thrown error on the checkout
 * page's primary action.
 */

import {
  fingerprintOrderCommand,
  forgetUnpaidOnlineOrder,
  readUnpaidOnlineOrder,
  rememberUnpaidOnlineOrder,
} from './unpaidOnlineOrder';

const KEY = 'sofra.checkout.unpaidOnlineOrder';

describe('unpaidOnlineOrder', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it('round-trips an order', () => {
    rememberUnpaidOnlineOrder({ orderId: 'order-1', signature: 'sig' });

    expect(readUnpaidOnlineOrder()).toEqual({ orderId: 'order-1', signature: 'sig' });
  });

  it('forgets it', () => {
    rememberUnpaidOnlineOrder({ orderId: 'order-1', signature: 'sig' });
    forgetUnpaidOnlineOrder();

    expect(readUnpaidOnlineOrder()).toBeNull();
  });

  it('reads null when nothing was remembered', () => {
    expect(readUnpaidOnlineOrder()).toBeNull();
  });

  it.each([
    ['not JSON at all', 'not json'],
    ['JSON that is not an object', '"a string"'],
    ['null', 'null'],
    ['an object missing orderId', '{"signature":"sig"}'],
    ['an object missing signature', '{"orderId":"order-1"}'],
    ['an object with the wrong types', '{"orderId":1,"signature":true}'],
  ])('reads null on a corrupt value: %s', (_label, raw) => {
    // Whatever is in there, the answer must be "no remembered order" — never a throw on the
    // checkout page's primary action, and never a half-built object that gets re-used as an id.
    sessionStorage.setItem(KEY, raw);

    expect(readUnpaidOnlineOrder()).toBeNull();
  });

  describe('when storage itself refuses', () => {
    it('reads null instead of throwing', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });

      expect(readUnpaidOnlineOrder()).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('swallows a failed write', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      // A retry may then create a second order — degraded, but far better than the primary action
      // throwing before the order is even placed.
      expect(() => rememberUnpaidOnlineOrder({ orderId: 'order-1', signature: 'sig' })).not.toThrow();
      expect(warn).toHaveBeenCalled();
    });

    it('swallows a failed clear', () => {
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });

      expect(() => forgetUnpaidOnlineOrder()).not.toThrow();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('fingerprintOrderCommand', () => {
    it('is equal for equal commands and different for different ones', () => {
      // A spurious MISmatch is the expensive direction — it creates a duplicate order — so the
      // equality case is the one that matters here.
      const a = { customerName: 'A', payments: [{ amount: 16.9 }] };
      const b = { customerName: 'A', payments: [{ amount: 16.9 }] };
      const withTip = { customerName: 'A', payments: [{ amount: 18.6 }] };

      expect(fingerprintOrderCommand(a)).toBe(fingerprintOrderCommand(b));
      expect(fingerprintOrderCommand(a)).not.toBe(fingerprintOrderCommand(withTip));
    });
  });
});
