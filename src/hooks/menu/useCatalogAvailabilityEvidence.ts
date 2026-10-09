'use client';

import { useCallback, useRef } from 'react';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import type { DetailedProduct, ItemAvailability } from '@/types/menu';
import type { OrderType } from '@/types/order';

export interface CatalogAvailabilityEvidence {
  availability: ItemAvailability;
  /** Null means the catalog verdict came from an unscoped snapshot. */
  orderType: OrderType | null;
}

/** Keeps a catalog block attached to its open sheet until the guest opens a fresh catalog row. */
export function useCatalogAvailabilityEvidence() {
  const evidenceRef = useRef<CatalogAvailabilityEvidence | null>(null);

  const clear = useCallback(() => {
    evidenceRef.current = null;
  }, []);

  const applyOnOpen = useCallback(
    (detail: DetailedProduct, options: OpenSheetOptions | undefined, requestedOrderType: OrderType | null) => {
      const cardAvailability = options?.availability;
      const detailIsBlocked = detail.availability?.canOrder === false;
      const availability = detailIsBlocked ? detail.availability : (cardAvailability ?? detail.availability);
      const sourceOrderType = detailIsBlocked ? requestedOrderType : options?.availabilityOrderType;
      evidenceRef.current =
        availability?.canOrder === false
          ? {
              availability,
              orderType: sourceOrderType !== undefined ? sourceOrderType : requestedOrderType,
            }
          : null;

      return availability ? { ...detail, availability } : detail;
    },
    [],
  );

  return { evidenceRef, clear, applyOnOpen };
}
