import type { PagedResult } from './common';
import type { OrderDto } from './orderDto';

/** Server-owned current-day archive and independent queue for unresolved orders from older days. */
export interface CashierDailyArchiveDto {
  businessDate: string;
  orders: PagedResult<OrderDto>;
  priorDayUnresolvedOrders: PagedResult<OrderDto>;
}

export interface CashierDailyArchiveQuery {
  businessDate?: string;
  search?: string;
  status?: string;
  paymentStatus?: string;
  orderType?: string;
  page?: number;
  pageSize?: number;
  priorDayUnresolvedPage?: number;
  priorDayUnresolvedPageSize?: number;
}
