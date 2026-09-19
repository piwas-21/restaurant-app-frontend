import type { AddPaymentRequest } from '@/services/cashierService';
import { clearPendingPayment, persistPendingPayment, readPendingPayment } from './cashierPendingPayment';

const payment: AddPaymentRequest = {
  operationId: 'operation-1',
  expectedVersion: 8,
  paymentMethod: 'Cash',
  amount: 18.5,
  transactionId: 'cash-1',
  paymentNotes: 'counter',
};

describe('cashier pending payment persistence', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips the immutable order and tender payload', () => {
    persistPendingPayment('order-1', payment);
    expect(readPendingPayment('order-1')).toEqual({ ...payment, orderId: 'order-1', status: 'Checking' });
    expect(window.sessionStorage.getItem('cashier.pending-payment')).toContain('operation-1');
  });

  it('does not expose a payload for another order', () => {
    persistPendingPayment('order-1', payment);
    expect(readPendingPayment('order-2')).toBeNull();
  });

  it('only clears the operation that was resolved', () => {
    persistPendingPayment('order-1', payment);
    clearPendingPayment('other-operation');
    expect(readPendingPayment('order-1')).not.toBeNull();
    clearPendingPayment(payment.operationId);
    expect(readPendingPayment('order-1')).toBeNull();
  });
});
