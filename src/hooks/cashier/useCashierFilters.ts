'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { OrderDto } from '@/types/order';

export interface UseCashierFiltersReturn {
  searchQuery: string;
  statusFilter: string;
  paymentStatusFilter: string;
  orderTypeFilter: string;
  filteredOrders: OrderDto[];
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  setPaymentStatusFilter: Dispatch<SetStateAction<string>>;
  setOrderTypeFilter: Dispatch<SetStateAction<string>>;
}

/**
 * Search/status/payment/order-type filters for the cashier orders list.
 * Also clears the parent's selection if the active filters drop the
 * selected order out of view.
 */
export function useCashierFilters(
  orders: OrderDto[],
  selectedOrderId: string | null,
  setSelectedOrderId: Dispatch<SetStateAction<string | null>>,
): UseCashierFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (paymentStatusFilter !== 'all' && order.paymentStatus !== paymentStatusFilter) return false;
      if (orderTypeFilter !== 'all' && order.type !== orderTypeFilter) return false;
      if (!query) return true;

      const matchesOrderNumber = order.orderNumber?.toLowerCase().includes(query);
      const matchesCustomerName = order.customerName?.toLowerCase().includes(query);
      const matchesCustomerEmail = order.customerEmail?.toLowerCase().includes(query);
      return Boolean(matchesOrderNumber || matchesCustomerName || matchesCustomerEmail);
    });
  }, [orders, searchQuery, statusFilter, paymentStatusFilter, orderTypeFilter]);

  useEffect(() => {
    if (selectedOrderId && !filteredOrders.find((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [filteredOrders, selectedOrderId, setSelectedOrderId]);

  return {
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    orderTypeFilter,
    filteredOrders,
    setSearchQuery,
    setStatusFilter,
    setPaymentStatusFilter,
    setOrderTypeFilter,
  };
}
