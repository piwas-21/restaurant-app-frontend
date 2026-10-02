import type { PagedResult, OrderDto } from '@/types/order';

export interface CashierQueuePage {
  readonly items: OrderDto[];
  readonly pagination: { totalCount: number; page: number; pageSize: number; totalPages: number };
  readonly requestedPageWasOutOfRange: boolean;
}

export function resolveCashierQueuePage(
  result: PagedResult<OrderDto>,
  requestedPage: number,
  fallbackPageSize: number,
): CashierQueuePage {
  const items = Array.isArray(result.items) ? result.items : [];
  const pageSize = result.pageSize > 0 ? result.pageSize : fallbackPageSize;
  const totalCount = Number.isFinite(result.totalCount) ? result.totalCount : items.length;
  const totalPages = result.totalPages > 0 ? result.totalPages : Math.ceil(totalCount / pageSize);
  const lastPage = Math.max(1, totalPages);
  return {
    items,
    pagination: {
      totalCount,
      page: Math.min(result.page > 0 ? result.page : requestedPage, lastPage),
      pageSize,
      totalPages,
    },
    requestedPageWasOutOfRange: requestedPage > lastPage,
  };
}
