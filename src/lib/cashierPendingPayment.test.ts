import type { AddPaymentRequest } from '@/services/cashierService';
import {
  clearPendingPayment,
  persistPendingPayment,
  readAnyPendingPayment,
  readPendingPaymentState,
} from './cashierPendingPayment';

const payment: AddPaymentRequest = {
  operationId: 'operation-1',
  expectedVersion: 8,
  paymentMethod: 'Cash',
  amount: 18.5,
  tipMinor: 275,
  transactionId: 'cash-1',
  paymentNotes: 'counter',
};

describe('cashier pending payment persistence', () => {
  beforeEach(() => window.sessionStorage.clear());

  afterEach(() => jest.restoreAllMocks());

  it('distinguishes a missing descriptor from an unavailable one', () => {
    expect(readAnyPendingPayment()).toEqual({ status: 'none' });

    window.sessionStorage.setItem('cashier.pending-payment', '{broken');
    expect(readAnyPendingPayment()).toEqual({ status: 'unavailable' });
  });

  it('reads a valid descriptor without needing an order selection', () => {
    persistPendingPayment('order-1', payment);

    expect(readAnyPendingPayment()).toEqual({
      status: 'pending',
      operation: { ...payment, orderId: 'order-1', status: 'Checking' },
    });
  });

  it('treats an unreadable session storage entry as unavailable', () => {
    persistPendingPayment('order-1', payment);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });

    expect(readAnyPendingPayment()).toEqual({ status: 'unavailable' });
  });

  it.each([
    ['missing operation identity', { orderId: 'order-1', paymentMethod: 'Cash', amount: 18.5 }],
    ['invalid amount', { orderId: 'order-1', operationId: 'operation-1', paymentMethod: 'Cash', amount: '18.5' }],
    [
      'invalid optional field',
      { orderId: 'order-1', operationId: 'operation-1', paymentMethod: 'Cash', amount: 18.5, tipMinor: '275' },
    ],
  ])('keeps %s descriptors blocking as unavailable', (_name, descriptor) => {
    window.sessionStorage.setItem('cashier.pending-payment', JSON.stringify(descriptor));
    expect(readAnyPendingPayment()).toEqual({ status: 'unavailable' });
  });

  it('round-trips the immutable order and tender payload', () => {
    persistPendingPayment('order-1', payment);
    expect(readPendingPaymentState('order-1')).toEqual({
      status: 'pending',
      operation: { ...payment, orderId: 'order-1', status: 'Checking' },
    });
    expect(window.sessionStorage.getItem('cashier.pending-payment')).toContain('operation-1');
  });

  it('persists reviewed cash received separately from the API payment payload', () => {
    const noTipPayment = { ...payment, amount: 19.75, tipMinor: undefined };
    persistPendingPayment('order-1', noTipPayment, 2000);

    expect(readPendingPaymentState('order-1')).toMatchObject({
      status: 'pending',
      operation: {
        ...noTipPayment,
        orderId: 'order-1',
        cashReceivedMinor: 2000,
        status: 'Checking',
      },
    });
    expect(JSON.parse(window.sessionStorage.getItem('cashier.pending-payment') ?? '{}')).toMatchObject({
      cashReceivedMinor: 2000,
    });
    expect(noTipPayment).not.toHaveProperty('cashReceivedMinor');
  });

  it('fails closed on persisted cash evidence below the frozen tender total', () => {
    window.sessionStorage.setItem(
      'cashier.pending-payment',
      JSON.stringify({ orderId: 'order-1', ...payment, cashReceivedMinor: 2124 }),
    );

    expect(readAnyPendingPayment()).toEqual({ status: 'unavailable' });
  });

  it('preserves the target for a valid descriptor belonging to another order', () => {
    persistPendingPayment('order-1', payment);
    expect(readPendingPaymentState('order-2')).toMatchObject({
      status: 'other-order',
      operation: { orderId: 'order-1', operationId: payment.operationId },
    });
  });

  it('only clears the operation that was resolved', () => {
    persistPendingPayment('order-1', payment);
    expect(clearPendingPayment('other-operation')).toBe(false);
    expect(clearPendingPayment(payment.operationId, 'another-order')).toBe(false);
    expect(readPendingPaymentState('order-1').status).toBe('pending');
    expect(clearPendingPayment(payment.operationId, 'order-1')).toBe(true);
    expect(readPendingPaymentState('order-1')).toEqual({ status: 'none' });
  });

  it('refuses to overwrite any unresolved or unreadable descriptor', () => {
    window.sessionStorage.setItem('cashier.pending-payment', '{broken');
    expect(persistPendingPayment('order-2', payment)).toBe('blocked');
    expect(window.sessionStorage.getItem('cashier.pending-payment')).toBe('{broken');
  });
});
