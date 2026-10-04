'use client';

import { useCallback } from 'react';
import { getProductById } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import type { Product } from '@/services/serverService';
import { OrderType } from '@/types/order';
import type { MenuBundleItem } from '@/types/menu';
import type { CustomizationResult, ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';
import { addCustomizedItem } from '@/components/catalog/orderItems';
import { buildBundleOrderItem } from '@/components/catalog/bundleOrderItems';
import type { WaiterBundleCustomizationResult } from '@/components/server/WaiterBundleCustomization';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { decideProductTap } from '@/components/catalog/productTap';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { getErrorMessage } from '@/utils/apiClient';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { useOptionalAuth } from '@/components/AuthContext';
import { serverTableRoundScopeKey, useServerTableRoundScopeState } from './useServerTableRoundScopeState';
import { useServerTableRoundOperations } from './useServerTableRoundOperations';

export function useServerTableRound(tableId: string, state: ServerTableSessionState, requestedSessionId?: string) {
  const auth = useOptionalAuth();
  const catalog = useServerTableRoundCatalog(auth?.user?.email);
  const sessionId = state.session?.serviceSessionId ?? null;
  const sessionMatchesQuery = Boolean(sessionId && requestedSessionId && requestedSessionId === sessionId);
  const scopeKey = serverTableRoundScopeKey(tableId, sessionId, sessionMatchesQuery, auth?.user?.email);
  const transient = useServerTableRoundScopeState(scopeKey);
  const {
    scopeToken,
    isCurrentScope,
    phase,
    setPhase,
    error,
    setError,
    selectedProduct,
    setSelectedProduct,
    selectedBundle,
    setSelectedBundle,
    bundleProduct,
    setBundleProduct,
    tapPendingId,
    setTapPendingId,
  } = transient;
  const draft = useServerTableRoundDraft(tableId, sessionId, sessionMatchesQuery, !state.isLoading);

  const canCompose = Boolean(state.canAddRound && sessionMatchesQuery && sessionId && !state.isStale && draft.isReady);
  const mutationsLocked = phase !== 'idle' || draft.operationState === 'unknown' || !canCompose;
  const canAddItems = !mutationsLocked && tapPendingId === null;

  const mutate = useCallback(
    (change: Parameters<typeof draft.mutate>[0]) => {
      if (!isCurrentScope(scopeToken) || mutationsLocked) return;
      setError(null);
      draft.mutate(change);
    },
    [draft, isCurrentScope, mutationsLocked, scopeToken, setError],
  );

  const tapProduct = useCallback(
    async (product: Product) => {
      if (!isCurrentScope(scopeToken) || mutationsLocked || tapPendingId !== null) return;
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
      } catch (error_: unknown) {
        if (isCurrentScope(scopeToken)) setError(getErrorMessage(error_) ?? 'server.round.product_unavailable');
      } finally {
        if (isCurrentScope(scopeToken)) setTapPendingId(null);
      }
    },
    [
      isCurrentScope,
      mutate,
      mutationsLocked,
      scopeToken,
      setBundleProduct,
      setError,
      setSelectedBundle,
      setSelectedProduct,
      setTapPendingId,
      tapPendingId,
    ],
  );

  const confirmCustomization = useCallback(
    (result: CustomizationResult) => {
      if (!isCurrentScope(scopeToken) || !selectedProduct) return;
      const product = selectedProduct;
      setSelectedProduct(null);
      mutate((current) => addCustomizedItem(current, product, result));
    },
    [isCurrentScope, mutate, scopeToken, selectedProduct, setSelectedProduct],
  );

  const confirmBundle = useCallback(
    (result: WaiterBundleCustomizationResult) => {
      if (!isCurrentScope(scopeToken) || !selectedBundle || !bundleProduct) return;
      const bundle = selectedBundle;
      const product = bundleProduct;
      setSelectedBundle(null);
      setBundleProduct(null);
      mutate((current) => [...current, buildBundleOrderItem(product, bundle, result)]);
    },
    [bundleProduct, isCurrentScope, mutate, scopeToken, selectedBundle, setBundleProduct, setSelectedBundle],
  );

  const { review, reconcile } = useServerTableRoundOperations({
    tableId,
    sessionId,
    staffUserId: auth?.user?.email,
    draft,
    canCompose,
    phase,
    setPhase,
    setError,
    scopeToken,
    isCurrentScope,
  });

  return {
    ...catalog,
    ...draft,
    setNotes: (value: string) => {
      if (isCurrentScope(scopeToken)) draft.setNotes(value);
    },
    setCustomer: (value: Parameters<typeof draft.setCustomer>[0]) => {
      if (isCurrentScope(scopeToken)) draft.setCustomer(value);
    },
    discardDraft: () => {
      if (isCurrentScope(scopeToken)) draft.discardDraft();
    },
    catalogError: catalog.error,
    phase,
    error,
    selectedProduct,
    selectedBundle,
    tapPendingId,
    ticketTotal: draft.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    canCompose,
    canAddItems,
    tapProduct,
    confirmCustomization,
    confirmBundle,
    closeCustomization: () => {
      if (isCurrentScope(scopeToken)) setSelectedProduct(null);
    },
    closeBundle: () => {
      if (!isCurrentScope(scopeToken)) return;
      setSelectedBundle(null);
      setBundleProduct(null);
    },
    setItemQuantity: (index: number, quantity: number) =>
      mutate((current) =>
        quantity <= 0
          ? current.filter((_, itemIndex) => itemIndex !== index)
          : current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity } : item)),
      ),
    removeItem: (index: number) => mutate((current) => current.filter((_, itemIndex) => itemIndex !== index)),
    review,
    reconcile,
    resumeDraft: () => {
      if (isCurrentScope(scopeToken)) draft.setDraftRecovered(false);
    },
  };
}
