import { getOrderTableLabel, orderBelongsToTable } from './orderTableLabel';

describe('getOrderTableLabel', () => {
  it('prefers a non-numeric server label', () => {
    expect(getOrderTableLabel({ tableLabel: ' T-QA ', tableNumber: null })).toBe('T-QA');
  });

  it('falls back to the legacy numeric table number', () => {
    expect(getOrderTableLabel({ tableLabel: null, tableNumber: 7 })).toBe('7');
  });

  it('returns null when an order has no table identity', () => {
    expect(getOrderTableLabel({ tableLabel: '  ', tableNumber: null })).toBeNull();
  });
});

describe('orderBelongsToTable', () => {
  it('uses stable table IDs before the legacy numeric fallback', () => {
    expect(orderBelongsToTable({ tableId: 'table-qa', tableNumber: null }, 'table-qa', 'T-QA')).toBe(true);
    expect(orderBelongsToTable({ tableId: 'another-table', tableNumber: 7 }, 'table-qa', '7')).toBe(false);
  });

  it('matches legacy numeric orders only when no stable ID is present', () => {
    expect(orderBelongsToTable({ tableId: null, tableNumber: 7 }, 'table-7', '7')).toBe(true);
  });

  it('never parses an arbitrary label as a numeric table number', () => {
    expect(orderBelongsToTable({ tableId: null, tableNumber: null }, 'table-qa', 'T-QA')).toBe(false);
  });
});
