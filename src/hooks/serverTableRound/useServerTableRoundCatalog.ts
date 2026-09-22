'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStaffOrderCatalog, type StaffOrderCategory } from '@/hooks/staffOrder/useStaffOrderCatalog';
import { OrderType } from '@/types/order';
import {
  persistServerTableRoundFavorites,
  readServerTableRoundFavorites,
  serverTableRoundFavoriteScope,
} from '@/lib/serverTableRoundFavorites';

export type ServerTableRoundCategory = StaffOrderCategory;

export function useServerTableRoundCatalog(staffIdentity?: string | null) {
  const options = useMemo(
    () => ({
      orderType: OrderType.DineIn,
      includeMenus: true,
      errorKey: 'server.round.catalog_error',
      showUnavailable: true,
    }),
    [],
  );
  const catalog = useStaffOrderCatalog(options);
  const [showFavorites, setShowFavorites] = useState(false);
  const favoriteScope = useMemo(() => serverTableRoundFavoriteScope(staffIdentity), [staffIdentity]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => setFavoriteIds(readServerTableRoundFavorites(favoriteScope)), [favoriteScope]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      setFavoriteIds((current) => {
        const next = current.includes(productId) ? current.filter((id) => id !== productId) : [productId, ...current];
        persistServerTableRoundFavorites(favoriteScope, next);
        return next;
      });
    },
    [favoriteScope],
  );

  return {
    ...catalog,
    products: showFavorites ? catalog.products.filter((product) => favoriteIds.includes(product.id)) : catalog.products,
    favoriteIds,
    showFavorites,
    setShowFavorites,
    toggleFavorite,
  };
}
