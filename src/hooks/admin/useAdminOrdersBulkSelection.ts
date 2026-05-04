'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { OrderDto } from '@/types/order';
import { exportOrdersToCSV } from '@/utils/exportUtils';
import { exportOrdersToPDF } from '@/utils/pdfExportUtils';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;

/**
 * Multi-select state for the admin orders table: tracks selected IDs,
 * provides toggle/select-all/clear, and the bulk CSV/PDF exports.
 */
export function useAdminOrdersBulkSelection(orders: OrderDto[], paginatedOrders: OrderDto[]) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedOrderIds((prev) =>
      prev.size === paginatedOrders.length ? new Set() : new Set(paginatedOrders.map((o) => o.id)),
    );
  };

  const clearSelection = useCallback(() => setSelectedOrderIds(new Set()), []);

  const selectedOrders = useCallback(
    () => orders.filter((o) => selectedOrderIds.has(o.id)),
    [orders, selectedOrderIds],
  );

  const handleBulkExportCSV = () => {
    const target = selectedOrders();
    exportOrdersToCSV(target, t);
    enqueueSnackbar(`Exported ${target.length} orders to CSV`, {
      variant: 'success',
      anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
    });
  };

  const handleBulkExportPDF = () => {
    const target = selectedOrders();
    exportOrdersToPDF(target, t);
    enqueueSnackbar(`Exported ${target.length} orders to PDF`, {
      variant: 'success',
      anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
    });
  };

  return {
    selectedOrderIds,
    selectedOrders,
    toggleOrderSelection,
    toggleSelectAll,
    clearSelection,
    handleBulkExportCSV,
    handleBulkExportPDF,
  };
}
