'use client';

import { useCallback, useRef } from 'react';
import { addCustomizedItem } from '@/components/catalog/orderItems';
import type { ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';
import { decideProductTap } from '@/components/catalog/productTap';
import type { Product } from '@/services/serverService';
import { getProductById } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import { OrderType } from '@/types/order';
import type { MenuBundleItem } from '@/types/menu';
import { getErrorMessage } from '@/utils/apiClient';
import { isMenuBundle } from '@/utils/productTypeFilter';
import type { ServerTableRoundScopeToken } from './useServerTableRoundScopeState';
import type { useServerTableRoundDraft } from './useServerTableRoundDraft';

type Draft = ReturnType<typeof useServerTableRoundDraft>;

interface Parameters {
  readonly scopeToken: ServerTableRoundScopeToken;
  readonly isCurrentScope: (token: ServerTableRoundScopeToken) => boolean;
  readonly mutationsLocked: boolean;
  readonly phaseIsIdle: () => boolean;
  readonly tapPendingId: string | null;
  readonly setTapPendingId: (id: string | null) => void;
  readonly setError: (error: string | null) => void;
  readonly setBundleProduct: (product: Product | null) => void;
  readonly setSelectedBundle: (bundle: MenuBundleItem | null) => void;
  readonly setSelectedProduct: (product: Product | null) => void;
  readonly mutate: Draft['mutate'];
}

export function useServerTableRoundProductTap({
  scopeToken,
  isCurrentScope,
  mutationsLocked,
  phaseIsIdle,
  tapPendingId,
  setTapPendingId,
  setError,
  setBundleProduct,
  setSelectedBundle,
  setSelectedProduct,
  mutate,
}: Parameters) {
  const inFlightScopes = useRef(new Set<ServerTableRoundScopeToken>());

  return useCallback(
    async (product: Product) => {
      if (
        !isCurrentScope(scopeToken) ||
        mutationsLocked ||
        !phaseIsIdle() ||
        tapPendingId !== null ||
        inFlightScopes.current.has(scopeToken)
      )
        return;
      inFlightScopes.current.add(scopeToken);
      setTapPendingId(product.id);
      setError(null);
      try {
        if (isMenuBundle(product)) {
          const response = (await getMenuBundleById(product.id, undefined, OrderType.DineIn)) as {
            success?: boolean;
            data?: MenuBundleItem | null;
          };
          if (!isCurrentScope(scopeToken)) return;
          if (!response.success || !response.data || response.data.availability?.canOrder === false) {
            setError('server.round.bundle_unavailable');
            return;
          }
          setBundleProduct(product);
          setSelectedBundle(response.data);
          return;
        }

        const response = (await getProductById(product.id, undefined, OrderType.DineIn)) as {
          success?: boolean;
          data?: ProductCustomizationDetail;
        };
        if (!isCurrentScope(scopeToken)) return;
        if (!response.success || !response.data || response.data.availability?.canOrder === false) {
          setError('server.round.product_unavailable');
          return;
        }
        const decision = decideProductTap(response.data);
        if (decision.kind === 'sheet') setSelectedProduct(product);
        else mutate((current) => addCustomizedItem(current, product, decision.result));
      } catch (error: unknown) {
        if (isCurrentScope(scopeToken)) setError(getErrorMessage(error) ?? 'server.round.product_unavailable');
      } finally {
        inFlightScopes.current.delete(scopeToken);
        if (isCurrentScope(scopeToken)) setTapPendingId(null);
      }
    },
    [
      isCurrentScope,
      mutate,
      mutationsLocked,
      phaseIsIdle,
      scopeToken,
      setBundleProduct,
      setError,
      setSelectedBundle,
      setSelectedProduct,
      setTapPendingId,
      tapPendingId,
    ],
  );
}
