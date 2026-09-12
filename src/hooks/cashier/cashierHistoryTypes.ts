import type { OrderListScope } from '@/types/order';

export type CashierHistoryRange = 'today' | 'yesterday' | 'week' | 'custom';

export interface CashierHistoryQuery {
  readonly scope: OrderListScope;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
  readonly orderType?: string;
  readonly tenantDay?: string;
  readonly tenantStartDay?: string;
  readonly tenantEndDay?: string;
}

export interface CashierHistoryFilters {
  readonly range: CashierHistoryRange;
  readonly fromDay: string;
  readonly toDay: string;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly paymentStatusFilter: string;
  readonly orderTypeFilter: string;
  readonly query: CashierHistoryQuery;
  readonly tenantDay: string | undefined;
  readonly tenantDayLoading: boolean;
  readonly tenantDayError: boolean;
  readonly tenantDayErrorMessage: string | null;
  readonly rangeReady: boolean;
  readonly setRange: (range: CashierHistoryRange) => void;
  readonly setFromDay: (day: string) => void;
  readonly setToDay: (day: string) => void;
  readonly setSearchQuery: (value: string) => void;
  readonly submitSearch: () => void;
  readonly setStatusFilter: (value: string) => void;
  readonly setPaymentStatusFilter: (value: string) => void;
  readonly setOrderTypeFilter: (value: string) => void;
  readonly setPage: (page: number) => void;
  readonly refreshTenantDay: () => void;
}
