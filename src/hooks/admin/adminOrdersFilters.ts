import { OrderDto, OrderStatus } from '@/types/order';

export interface ServerFilterInputs {
  selectedStatus: OrderStatus | 'All';
  selectedPaymentStatus: string;
  selectedOrderType: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

export interface ClientFilterInputs {
  searchQuery: string;
  showFocusOnly: boolean;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

/** Build the filter object that gets sent to the orders API. */
export function buildServerFilters(f: ServerFilterInputs): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (f.selectedStatus !== 'All') filters.status = f.selectedStatus;
  if (f.selectedPaymentStatus !== 'All') filters.paymentStatus = f.selectedPaymentStatus;
  if (f.selectedOrderType !== 'All') filters.orderType = f.selectedOrderType;
  if (f.dateRangeStart) filters.startDate = f.dateRangeStart;
  if (f.dateRangeEnd) filters.endDate = f.dateRangeEnd;
  return filters;
}

/** Apply the client-only filters (focus, search) and sort the result list. */
export function applyClientFilterAndSort(items: OrderDto[], f: ClientFilterInputs): OrderDto[] {
  let next = items;
  if (f.showFocusOnly) next = next.filter((order) => order.isFocusOrder);

  const query = f.searchQuery.trim().toLowerCase();
  if (query) {
    next = next.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.customerEmail?.toLowerCase().includes(query) ||
        order.customerPhone?.toLowerCase().includes(query),
    );
  }

  return [...next].sort((a, b) => {
    const cmp =
      f.sortBy === 'date' ? new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime() : b.total - a.total;
    return f.sortOrder === 'desc' ? cmp : -cmp;
  });
}
