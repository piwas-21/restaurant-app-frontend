import type { CashierTableEntry } from './cashierTableEntries';
import { cashierTableQueueState, findSelectedCashierTableEntry } from './cashierTableWorkspace';

const entry = (id: string, tableNumber: string): CashierTableEntry => ({
  table: {
    id,
    tableNumber,
    maxGuests: 2,
    isActive: true,
    isOutdoor: false,
    positionX: 0,
    positionY: 0,
  },
  session: null,
  status: 'available',
});

describe('cashier table workspace selection', () => {
  it('prefers an exact label and only falls back to an unambiguous compatible number', () => {
    const entries = [entry('one', '1'), entry('zero-one', '01')];
    expect(findSelectedCashierTableEntry(entries, null, '01')?.table.id).toBe('zero-one');
    expect(findSelectedCashierTableEntry([entry('one', '1')], null, '001')?.table.id).toBe('one');
    expect(findSelectedCashierTableEntry(entries, null, '001')).toBeNull();
  });
});

describe('cashier table queue state', () => {
  it('distinguishes ordinary, loading, stale and unavailable session reads', () => {
    expect(cashierTableQueueState('ready', null, true, true, false, false)).toBe('ready');
    expect(cashierTableQueueState('ready', 'visit', true, false, false, false)).toBe('loading');
    expect(cashierTableQueueState('ready', 'visit', false, false, false, false)).toBe('ready');
    expect(cashierTableQueueState('ready', 'visit', false, true, true, false)).toBe('stale');
    expect(cashierTableQueueState('ready', 'visit', false, true, false, false)).toBe('unavailable');
  });
});
