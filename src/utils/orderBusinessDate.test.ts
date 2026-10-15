import type { CashierOrderGroupDto } from '@/types/cashier';
import type { OrderDto } from '@/types/order';
import { filterCashierGroupsToBusinessDate, filterOrdersToBusinessDate } from './orderBusinessDate';

function order(id: string, date: string, businessDate?: string): OrderDto {
  return {
    id,
    orderNumber: id,
    orderDate: date,
    businessDate,
  } as OrderDto;
}

it('keeps only the active business-day round in visible groups without mutating canonical group data', () => {
  const group: CashierOrderGroupDto = {
    groupKey: 'visit:session-1',
    serviceSessionId: 'session-1',
    tableNumber: 5,
    releasedAt: null,
    isArchivedFromTable: false,
    orders: [
      order('previous', '2026-10-14T21:00:00.000Z', '2026-10-14'),
      order('today', '2026-10-15T10:00:00.000Z', '2026-10-15'),
    ],
  };

  const visible = filterCashierGroupsToBusinessDate([group], '2026-10-15', 'Europe/Amsterdam');

  expect(visible[0].orders.map(({ id }) => id)).toEqual(['today']);
  expect(group.orders).toHaveLength(2);
  expect(filterOrdersToBusinessDate(group.orders, '2026-10-15', 'Europe/Amsterdam')).toEqual([group.orders[1]]);
});

it('uses tenant-local order time when reading an older DTO without businessDate', () => {
  const nearMidnight = order('late', '2026-10-14T22:30:00.000Z');

  expect(filterOrdersToBusinessDate([nearMidnight], '2026-10-15', 'Europe/Amsterdam')).toEqual([nearMidnight]);
});

it('ignores fallback date formatting when the tenant timezone is invalid', () => {
  const legacy = order('legacy', '2026-10-15T10:00:00Z');

  expect(filterOrdersToBusinessDate([legacy], '2026-10-15', 'Invalid/Zone')).toEqual([]);
});
