import type { TableServiceSessionDto } from '@/types/order';
import { formatTableMoney, tableNumberKey, tableSessionActions, tableSessionCurrency } from './cashierTableSession';

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

  it('uses captured session currency for display and tenant fallback when absent', () => {
    const session = makeSession();
    expect(tableSessionCurrency(session)).toBe('EUR');
    expect(formatTableMoney(20, session)).toContain('20');
    expect(tableSessionCurrency(makeSession({ currency: null, bill: { ...session.bill, currency: null } }))).toMatch(
      /^[A-Z]{3}$/,
    );
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
