'use client';

import { useCallback, useRef, useState } from 'react';
import type { Product } from '@/services/serverService';
import type { MenuBundleItem } from '@/types/menu';
import { getServerTableRoundDraftScope } from '@/lib/serverTableRoundDraft';

export type ServerTableRoundScopeToken = Readonly<{ key: string | null }>;
type Phase = 'idle' | 'reviewing' | 'reconciling';

interface ScopedUiState {
  readonly scopeToken: ServerTableRoundScopeToken;
  readonly phase: Phase;
  readonly error: string | null;
  readonly selectedProduct: Product | null;
  readonly selectedBundle: MenuBundleItem | null;
  readonly bundleProduct: Product | null;
  readonly tapPendingId: string | null;
}

type ScopedUiChange = Partial<Omit<ScopedUiState, 'scopeToken'>>;

function emptyUiState(scopeToken: ServerTableRoundScopeToken): ScopedUiState {
  return {
    scopeToken,
    phase: 'idle',
    error: null,
    selectedProduct: null,
    selectedBundle: null,
    bundleProduct: null,
    tapPendingId: null,
  };
}

export function serverTableRoundScopeKey(
  tableId: string,
  sessionId: string | null,
  sessionMatchesQuery: boolean,
  staffUserId?: string | null,
): string | null {
  if (!sessionId || !sessionMatchesQuery) return null;
  const owner = getServerTableRoundDraftScope(staffUserId ?? undefined);
  return JSON.stringify([tableId, sessionId, owner?.tenantId ?? null, owner?.staffUserId ?? null]);
}

export function useServerTableRoundScopeState(scopeKey: string | null) {
  const scopeRef = useRef<ServerTableRoundScopeToken>({ key: scopeKey });
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey };
  const scopeToken = scopeRef.current;
  const isCurrentScope = useCallback((candidate: ServerTableRoundScopeToken) => scopeRef.current === candidate, []);
  const [storedState, setStoredState] = useState(() => emptyUiState(scopeToken));
  const visibleState = storedState.scopeToken === scopeToken ? storedState : emptyUiState(scopeToken);
  const update = useCallback((candidate: ServerTableRoundScopeToken, change: ScopedUiChange) => {
    if (scopeRef.current !== candidate) return;
    setStoredState((current) => {
      if (scopeRef.current !== candidate) return current;
      const base = current.scopeToken === candidate ? current : emptyUiState(candidate);
      return { ...base, ...change };
    });
  }, []);
  const setPhase = useCallback((phase: Phase) => update(scopeToken, { phase }), [scopeToken, update]);
  const setError = useCallback((error: string | null) => update(scopeToken, { error }), [scopeToken, update]);
  const setSelectedProduct = useCallback(
    (selectedProduct: Product | null) => update(scopeToken, { selectedProduct }),
    [scopeToken, update],
  );
  const setSelectedBundle = useCallback(
    (selectedBundle: MenuBundleItem | null) => update(scopeToken, { selectedBundle }),
    [scopeToken, update],
  );
  const setBundleProduct = useCallback(
    (bundleProduct: Product | null) => update(scopeToken, { bundleProduct }),
    [scopeToken, update],
  );
  const setTapPendingId = useCallback(
    (tapPendingId: string | null) => update(scopeToken, { tapPendingId }),
    [scopeToken, update],
  );

  return {
    scopeToken,
    isCurrentScope,
    phase: visibleState.phase,
    setPhase,
    error: visibleState.error,
    setError,
    selectedProduct: visibleState.selectedProduct,
    setSelectedProduct,
    selectedBundle: visibleState.selectedBundle,
    setSelectedBundle,
    bundleProduct: visibleState.bundleProduct,
    setBundleProduct,
    tapPendingId: visibleState.tapPendingId,
    setTapPendingId,
  };
}
