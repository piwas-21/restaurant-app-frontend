import type { CashierDailyArchiveQuery, OrderDto, PagedResult } from '@/types/order';
import type { CashierHistoryQuery } from './cashierHistoryTypes';

export function emptyCashierHistoryPage(query: CashierHistoryQuery): PagedResult<OrderDto> {
  return {
    items: [],
    totalCount: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

export function toCashierDailyArchiveQuery(
  query: CashierHistoryQuery,
  priorDayUnresolvedPage = 1,
): CashierDailyArchiveQuery {
  return {
    businessDate: query.archiveBusinessDate,
    search: query.search,
    status: query.status,
    paymentStatus: query.paymentStatus,
    orderType: query.orderType,
    page: query.page,
    pageSize: query.pageSize,
    priorDayUnresolvedPage,
    priorDayUnresolvedPageSize: 50,
  };
}
