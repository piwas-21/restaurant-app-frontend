import type { DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';
import { deliveryChannelMappingView } from './deliveryChannelMappingView';

function mappingRow(
  providerItemId: string,
  overrides: Partial<DeliveryChannelMappingRow> = {},
): DeliveryChannelMappingRow {
  return {
    providerItemId,
    providerItemName: `Provider item ${providerItemId}`,
    productId: null,
    variationId: null,
    productName: null,
    variationName: null,
    tenantPriceMinor: null,
    providerPriceMinor: null,
    providerPriceStatus: 'unknown',
    currency: 'EUR',
    available: false,
    mappingStatus: 'unmapped',
    blockReason: null,
    ...overrides,
  };
}

describe('deliveryChannelMappingView', () => {
  it('filters by status and searches source and tenant labels without changing row identities', () => {
    const rows = [
      mappingRow('provider-1', {
        providerItemName: 'Crème brûlée',
        productId: 'tenant-product-1',
        productName: 'Creme dessert',
        mappingStatus: 'mapped',
      }),
      mappingRow('provider-2', {
        providerItemName: 'Crème base',
        productId: 'tenant-product-2',
        productName: 'Creme base',
        mappingStatus: 'unmapped',
      }),
      mappingRow('provider-3', {
        providerItemName: 'Tea',
        productId: 'tenant-product-3',
        productName: 'Crème tea',
        mappingStatus: 'blocked',
      }),
    ];

    const view = deliveryChannelMappingView(rows, { status: 'mapped', search: 'creme', page: 0 });

    expect(view.rows).toEqual([rows[0]]);
    expect(view.total).toBe(1);
    expect(rows.map((row) => row.providerItemId)).toEqual(['provider-1', 'provider-2', 'provider-3']);
  });

  it('paginates in source order and clamps a stale page after filtering shrinks the result', () => {
    const rows = Array.from({ length: 45 }, (_, index) => mappingRow(`provider-${index + 1}`));

    const middle = deliveryChannelMappingView(rows, { status: 'all', search: '', page: 1, pageSize: 20 });
    expect(middle.rows.map((row) => row.providerItemId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `provider-${index + 21}`),
    );
    expect(middle).toMatchObject({ total: 45, page: 1, pageCount: 3, start: 21, end: 40 });

    const last = deliveryChannelMappingView(rows.slice(0, 22), {
      status: 'all',
      search: '',
      page: 8,
      pageSize: 20,
    });
    expect(last.rows.map((row) => row.providerItemId)).toEqual(['provider-21', 'provider-22']);
    expect(last).toMatchObject({ total: 22, page: 1, pageCount: 2, start: 21, end: 22 });
  });

  it('returns an empty first page when no mapping row matches', () => {
    const view = deliveryChannelMappingView([mappingRow('provider-1')], {
      status: 'blocked',
      search: 'missing',
      page: 4,
    });

    expect(view).toMatchObject({ rows: [], total: 0, page: 0, pageCount: 0, start: 0, end: 0 });
  });

  it('rejects an invalid page size instead of producing an unstable range', () => {
    expect(() => deliveryChannelMappingView([], { status: 'all', search: '', page: 0, pageSize: 0 })).toThrow(
      'pageSize must be a positive integer',
    );
  });
});
