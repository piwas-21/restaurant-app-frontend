'use client';

import { useCallback, useState } from 'react';
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
import { persistServerTableRoundDraft } from '@/lib/serverTableRoundDraft';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { useOptionalAuth } from '@/components/AuthContext';

export function useServerTableRound(tableId: string, state: ServerTableSessionState, requestedSessionId?: string) {
  const auth = useOptionalAuth();
  const catalog = useServerTableRoundCatalog(auth?.user?.email);
  const sessionId = state.session?.serviceSessionId ?? null;
  const sessionMatchesQuery = Boolean(sessionId && requestedSessionId && requestedSessionId === sessionId);
  const draft = useServerTableRoundDraft(tableId, sessionId, sessionMatchesQuery, !state.isLoading);
  const [phase, setPhase] = useState<'idle' | 'reviewing' | 'reconciling'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<MenuBundleItem | null>(null);
  const [bundleProduct, setBundleProduct] = useState<Product | null>(null);
  const [tapPendingId, setTapPendingId] = useState<string | null>(null);

  const canCompose = Boolean(state.canAddRound && sessionMatchesQuery && sessionId && !state.isStale);
  const mutationsLocked = phase !== 'idle' || draft.operationState === 'unknown' || !canCompose;

  const mutate = useCallback(
    (change: Parameters<typeof draft.mutate>[0]) => {
      if (mutationsLocked) return;
      setError(null);
      draft.mutate(change);
    },
    [draft, mutationsLocked],
  );

  const tapProduct = useCallback(
    async (product: Product) => {
      if (mutationsLocked || tapPendingId !== null) return;
      setTapPendingId(product.id);
      setError(null);
      try {
        if (isMenuBundle(product)) {
          const response = (await getMenuBundleById(product.id, undefined, OrderType.DineIn)) as {
            success?: boolean;
            data?: MenuBundleItem | null;
          };
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
        if (!response.success || !response.data || response.data.availability?.canOrder === false) {
          setError('server.round.product_unavailable');
          return;
        }
        const decision = decideProductTap(response.data);
        if (decision.kind === 'sheet') setSelectedProduct(product);
        else mutate((current) => addCustomizedItem(current, product, decision.result));
      } catch (caught: unknown) {
        setError(getErrorMessage(caught) ?? 'server.round.product_unavailable');
      } finally {
        setTapPendingId(null);
      }
    },
    [mutate, mutationsLocked, tapPendingId],
  );

  const confirmCustomization = useCallback(
    (result: CustomizationResult) => {
      if (!selectedProduct) return;
      const product = selectedProduct;
      setSelectedProduct(null);
      mutate((current) => addCustomizedItem(current, product, result));
    },
    [mutate, selectedProduct],
  );

  const confirmBundle = useCallback(
    (result: WaiterBundleCustomizationResult) => {
      if (!selectedBundle || !bundleProduct) return;
      const bundle = selectedBundle;
      const product = bundleProduct;
      setSelectedBundle(null);
      setBundleProduct(null);
      mutate((current) => [...current, buildBundleOrderItem(product, bundle, result)]);
    },
    [bundleProduct, mutate, selectedBundle],
  );

  const review = useCallback(async () => {
    if (!canCompose || !sessionId || draft.items.length === 0 || phase !== 'idle') return;
    setPhase('reviewing');
    setError(null);
    const operationId = draft.operationId ?? crypto.randomUUID();
    draft.setOperationId(operationId);
    persistServerTableRoundDraft(
      {
        tableId,
        serviceSessionId: sessionId,
        items: draft.items,
        notes: draft.notes,
        clientOperationId: operationId,
      },
      auth?.user?.email,
    );
    const outcome = await reviewServerTableRound({
      tableId,
      serviceSessionId: sessionId,
      items: draft.items,
      notes: draft.notes,
      storedOperationId: operationId,
    });
    if (outcome.quote) draft.setQuote(outcome.quote);
    if (outcome.status === 'committed' && outcome.order) {
      draft.markCommitted(outcome.order);
      setPhase('idle');
      return;
    }
    if (outcome.status === 'unknown') {
      const reconciled = await reconcileServerTableRound(operationId);
      if (reconciled.status === 'committed' && reconciled.order) draft.markCommitted(reconciled.order);
      else {
        draft.setOperationState('unknown');
        setError(reconciled.error ?? outcome.error ?? 'server.round.operation_unknown');
      }
    } else {
      draft.setOperationState('failed');
      setError(outcome.error ?? 'server.round.review_failed');
    }
    setPhase('idle');
  }, [auth?.user?.email, canCompose, draft, phase, sessionId, tableId]);

  const reconcile = useCallback(async () => {
    if (!draft.operationId || phase !== 'idle') return;
    setPhase('reconciling');
    const outcome = await reconcileServerTableRound(draft.operationId);
    if (outcome.status === 'committed' && outcome.order) {
      draft.markCommitted(outcome.order);
      setError(null);
    } else {
      draft.setOperationState('unknown');
      setError(outcome.error ?? 'server.round.operation_unknown');
    }
    setPhase('idle');
  }, [draft, phase]);

  return {
    ...catalog,
    ...draft,
    catalogError: catalog.error,
    phase,
    error,
    selectedProduct,
    selectedBundle,
    tapPendingId,
    ticketTotal: draft.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    canCompose,
    tapProduct,
    confirmCustomization,
    confirmBundle,
    closeCustomization: () => setSelectedProduct(null),
    closeBundle: () => {
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
    resumeDraft: () => draft.setDraftRecovered(false),
  };
}
