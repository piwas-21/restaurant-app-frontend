'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Product } from '@/services/serverService';
import type { MenuBundleItem } from '@/types/menu';

export type ServerTableRoundScopeToken = Readonly<{ key: string | null }>;

export function serverTableRoundScopeKey(
  tableId: string,
  sessionId: string | null,
  sessionMatchesQuery: boolean,
  staffUserId?: string | null,
): string | null {
  return sessionId && sessionMatchesQuery
    ? JSON.stringify([tableId, sessionId, staffUserId?.trim().toLowerCase() ?? null])
    : null;
}

export function useServerTableRoundScopeState(scopeKey: string | null) {
  const scopeRef = useRef<ServerTableRoundScopeToken>({ key: scopeKey });
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey };
  const scopeToken = scopeRef.current;
  const isCurrentScope = useCallback((candidate: ServerTableRoundScopeToken) => scopeRef.current === candidate, []);
  const [phase, setPhase] = useState<'idle' | 'reviewing' | 'reconciling'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<MenuBundleItem | null>(null);
  const [bundleProduct, setBundleProduct] = useState<Product | null>(null);
  const [tapPendingId, setTapPendingId] = useState<string | null>(null);
  const previousScopeRef = useRef(scopeToken);

  useEffect(() => {
    if (previousScopeRef.current === scopeToken) return;
    previousScopeRef.current = scopeToken;
    setPhase('idle');
    setError(null);
    setSelectedProduct(null);
    setSelectedBundle(null);
    setBundleProduct(null);
    setTapPendingId(null);
  }, [scopeToken]);

  return {
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
  };
}
