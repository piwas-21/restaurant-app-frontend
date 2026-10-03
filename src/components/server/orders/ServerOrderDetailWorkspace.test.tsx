import type { OrderDto } from '@/types/order';
import { serverOrderVisitHref } from './serverOrderRoute';

describe('serverOrderVisitHref', () => {
  it('carries the exact table, visit, and source-order identities', () => {
    const href = serverOrderVisitHref({
      id: 'order/1',
      type: 'DineIn',
      tableId: 'table/9',
      tableLabel: 'T9',
      serviceSessionId: 'visit/42',
    } as OrderDto);

    expect(href).toBe('/server/tables/table%2F9?serviceSessionId=visit%2F42&orderId=order%2F1');
  });

  it.each([
    { tableId: null, serviceSessionId: 'visit-1' },
    { tableId: 'table-1', serviceSessionId: null },
    { tableId: null, serviceSessionId: null },
  ])('does not re-resolve a DineIn visit from the display label when identity is incomplete', (identity) => {
    expect(
      serverOrderVisitHref({
        id: 'order-1',
        type: 'DineIn',
        tableLabel: 'T9',
        ...identity,
      } as OrderDto),
    ).toBeNull();
  });

  it('does not create a table-visit link for takeaway or delivery orders', () => {
    expect(
      serverOrderVisitHref({ type: 'Takeaway', tableId: 'table-1', serviceSessionId: 'visit-1' } as OrderDto),
    ).toBeNull();
    expect(
      serverOrderVisitHref({ type: 'Delivery', tableId: 'table-1', serviceSessionId: 'visit-1' } as OrderDto),
    ).toBeNull();
  });
});
