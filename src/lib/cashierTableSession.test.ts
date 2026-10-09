import type { TableServiceSessionDto } from '@/types/order';
import {
  formatTableMoney,
  tableNumberKey,
  tableOrderSettlementState,
  tablePaymentFlowTranslationKey,
  tableSplitStatusTranslationKey,
  tableSessionActions,
  tableSessionCurrency,
} from './cashierTableSession';

const makeSession = (over: Partial<TableServiceSessionDto> = {}): TableServiceSessionDto => ({
  serviceSessionId: 'session-1',
  tableNumber: 7,
  currency: 'EUR',
  status: 'Open',
  version: 1,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 10,
  outstanding: 20,
  bill: {
    tableNumber: 7,
    generatedAt: '2026-09-12T18:00:00Z',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 1,
    currency: 'EUR',
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
  ...over,
});

describe('table session policy', () => {
  it('normalizes numeric table identity at the table/session seam', () => {
    expect(tableNumberKey('007')).toBe('7');
    expect(tableNumberKey(7)).toBe('7');
    expect(tableNumberKey('bar')).toBe('bar');
  });

  it('uses server bill fields to expose only safe actions', () => {
    const open = makeSession();
    expect([...tableSessionActions(open)]).toEqual(['collect']);
    expect(tableSessionActions(makeSession({ outstanding: 0 }))).toEqual(new Set(['close']));
    expect(tableSessionActions(makeSession({ status: 'Closed' }))).toEqual(new Set());
    expect(tableSessionActions(makeSession({ bill: { ...open.bill, isAmbiguous: true } }))).toEqual(new Set());
  });

  it('uses captured server currency and keeps missing currency unknown', () => {
    const session = makeSession();
    expect(tableSessionCurrency(session)).toBe('EUR');
    expect(formatTableMoney(20, session)).toContain('20');
    const unknown = makeSession({ currency: null, bill: { ...session.bill, currency: null } });
    expect(tableSessionCurrency(unknown)).toBeNull();
    expect(formatTableMoney(20, unknown)).toBeNull();
    expect(
      tableSessionCurrency(
        makeSession({
          currency: null,
          bill: {
            ...session.bill,
            currency: null,
            orders: [{ currency: 'EUR' } as never],
          },
        }),
      ),
    ).toBe('EUR');
  });
});

describe('table bill translation keys', () => {
  it('maps each supported payment flow and guest collection state to a literal key', () => {
    expect(tablePaymentFlowTranslationKey('Full')).toBe('cashier.tables.payment_flow_full');
    expect(tablePaymentFlowTranslationKey('Amount')).toBe('cashier.tables.payment_flow_amount');
    expect(tablePaymentFlowTranslationKey('Equal')).toBe('cashier.tables.payment_flow_equal');
    expect(tablePaymentFlowTranslationKey('CustomAmount')).toBe('cashier.tables.payment_flow_custom');
    expect(tablePaymentFlowTranslationKey('ByItems')).toBe('cashier.tables.payment_flow_items');
    expect(tablePaymentFlowTranslationKey('FutureMode')).toBe('cashier.tables.payment_flow');
    expect(tableSplitStatusTranslationKey('Due')).toBe('cashier.tables.split_status_due');
    expect(tableSplitStatusTranslationKey('Captured')).toBe('cashier.tables.split_status_captured');
    expect(tableSplitStatusTranslationKey('Reserved')).toBe('cashier.tables.split_status_reserved');
    expect(tableSplitStatusTranslationKey('FutureStatus')).toBe('cashier.tables.split_status_due');
  });
});

describe('table order settlement states', () => {
  const order = (over: Record<string, unknown> = {}) =>
    ({ status: 'Completed', paymentStatus: 'Completed', remainingAmount: 0, payments: [], ...over }) as never;

  it('distinguishes eligible debt, credit and refunds', () => {
    expect(tableOrderSettlementState(order({ remainingAmount: 12, paymentStatus: 'Pending' }))).toBe('eligible');
    expect(tableOrderSettlementState(order({ paymentStatus: 'Overpaid', remainingAmount: -2 }))).toBe('credit');
    expect(tableOrderSettlementState(order({ paymentStatus: 'Refunded', remainingAmount: 12 }))).toBe('refunded');
  });

  it('does not expose collect when a refundable round would block oldest-first allocation', () => {
    const base = makeSession({ outstanding: 20 });
    const refunded = {
      id: 'refund',
      status: 'Completed',
      paymentStatus: 'Refunded',
      remainingAmount: 10,
      payments: [],
    } as never;
    const eligible = {
      id: 'eligible',
      status: 'Completed',
      paymentStatus: 'Pending',
      remainingAmount: 10,
      payments: [],
    } as never;
    expect(tableSessionActions({ ...base, bill: { ...base.bill, orders: [refunded, eligible] } })).toEqual(new Set());
  });
});
