import { getOrderDisplayNumber } from './orderDisplay';

it('uses the daily sequence when present and retains the legacy reference as fallback', () => {
  expect(getOrderDisplayNumber({ dailyOrderNumber: 42, orderNumber: 'ORD-42' })).toBe('42');
  expect(getOrderDisplayNumber({ dailyOrderNumber: 0, orderNumber: 'ORD-42' })).toBe('ORD-42');
  expect(getOrderDisplayNumber({ orderNumber: '  ORD-43  ' })).toBe('ORD-43');
});
