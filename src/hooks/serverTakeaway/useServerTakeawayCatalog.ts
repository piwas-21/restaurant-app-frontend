'use client';

import { useMemo } from 'react';
import { useStaffOrderCatalog, type StaffOrderCategory } from '@/hooks/staffOrder/useStaffOrderCatalog';
import { OrderType } from '@/types/order';
import { isMenuBundle } from '@/utils/productTypeFilter';

export type ServerTakeawayCategory = StaffOrderCategory;

export function useServerTakeawayCatalog() {
  const options = useMemo(
    () => ({
      orderType: OrderType.Takeaway,
      includeMenus: false,
      errorKey: 'server.takeaway.catalog_error',
      filterProduct: (product: Parameters<typeof isMenuBundle>[0]) => !isMenuBundle(product),
    }),
    [],
  );
  return useStaffOrderCatalog(options);
}
