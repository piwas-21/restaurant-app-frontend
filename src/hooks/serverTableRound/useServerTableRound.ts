'use client';

import { useCallback, useRef } from 'react';
import type { CustomizationResult } from '@/components/catalog/productCustomizationTypes';
import { addCustomizedItem } from '@/components/catalog/orderItems';
import { buildBundleOrderItem } from '@/components/catalog/bundleOrderItems';
import type { WaiterBundleCustomizationResult } from '@/components/server/WaiterBundleCustomization';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { guardRoundMutation } from './serverTableRoundDraftState';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { useOptionalAuth } from '@/components/AuthContext';
import { serverTableRoundScopeKey, useServerTableRoundScopeState } from './useServerTableRoundScopeState';
import { useServerTableRoundOperations } from './useServerTableRoundOperations';
import { useServerTableRoundProductTap } from './useServerTableRoundProductTap';

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
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const draft = useServerTableRoundDraft(tableId, sessionId, sessionMatchesQuery, !state.isLoading);

  const canCompose = Boolean(state.canAddRound && sessionMatchesQuery && sessionId && !state.isStale && draft.isReady);
  const mutationsLocked = phase !== 'idle' || draft.operationState === 'unknown' || !canCompose;
  const canAddItems = !mutationsLocked && tapPendingId === null;
  const canMutateDraft = () => isCurrentScope(scopeToken) && !mutationsLocked && phaseRef.current === 'idle';
  const canDiscardDraft = () =>
    isCurrentScope(scopeToken) && phaseRef.current === 'idle' && draft.operationState !== 'unknown';

  const mutate = useCallback(
    (change: Parameters<typeof draft.mutate>[0]) => {
      if (!isCurrentScope(scopeToken) || mutationsLocked || phaseRef.current !== 'idle') return;
      setError(null);
      draft.mutate(change);
    },
    [draft, isCurrentScope, mutationsLocked, scopeToken, setError],
  );

  const tapProduct = useServerTableRoundProductTap({
    scopeToken,
    isCurrentScope,
    mutationsLocked,
    phaseIsIdle: () => phaseRef.current === 'idle',
    tapPendingId,
    setTapPendingId,
    setError,
    setBundleProduct,
    setSelectedBundle,
    setSelectedProduct,
    mutate,
  });

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
    setPhase: (nextPhase) => {
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
    },
    setError,
    scopeToken,
    isCurrentScope,
  });

  return {
    ...catalog,
    ...draft,
    mutate,
    setItems: guardRoundMutation(canMutateDraft, draft.setItems),
    setNotes: guardRoundMutation(canMutateDraft, draft.setNotes),
    setCustomer: guardRoundMutation(canMutateDraft, draft.setCustomer),
    discardDraft: guardRoundMutation(canDiscardDraft, draft.discardDraft),
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
