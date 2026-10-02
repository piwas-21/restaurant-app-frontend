import { fold } from '@/utils/nameFold';
import type { DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';

export const DELIVERY_CHANNEL_MAPPING_PAGE_SIZE = 20;

export type DeliveryChannelMappingStatusFilter = 'all' | DeliveryChannelMappingRow['mappingStatus'];

export interface DeliveryChannelMappingView {
  readonly rows: readonly DeliveryChannelMappingRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  readonly end: number;
}

export function deliveryChannelMappingView(
  rows: readonly DeliveryChannelMappingRow[],
  options: {
    readonly status: DeliveryChannelMappingStatusFilter;
    readonly search: string;
    readonly page: number;
    readonly pageSize?: number;
  },
): DeliveryChannelMappingView {
  const pageSize = options.pageSize ?? DELIVERY_CHANNEL_MAPPING_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError('pageSize must be a positive integer');

  const search = fold(options.search);
  const filtered = rows.filter((row) => {
    if (options.status !== 'all' && row.mappingStatus !== options.status) return false;
    if (!search) return true;

    return [row.providerItemName, row.providerItemId, row.productName, row.variationName]
      .filter((value): value is string => Boolean(value))
      .some((value) => fold(value).includes(search));
  });

  const total = filtered.length;
  const pageCount = Math.ceil(total / pageSize);
  const page = Math.max(0, Math.min(Math.trunc(options.page), Math.max(pageCount - 1, 0)));
  const startOffset = page * pageSize;
  return {
    rows: filtered.slice(startOffset, startOffset + pageSize),
    total,
    page,
    pageCount,
    start: total === 0 ? 0 : startOffset + 1,
    end: Math.min(startOffset + pageSize, total),
  };
}
