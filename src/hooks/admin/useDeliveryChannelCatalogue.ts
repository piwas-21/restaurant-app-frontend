'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routeApiError } from '@/utils/apiFormErrors';
import {
  classifyDeliveryChannelMutationFailure,
  deliveryChannelManagementService,
  type DeliveryChannelMutationFailure,
} from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelCatalogueCandidate,
  DeliveryChannelCatalogueDraft,
} from '@/types/deliveryChannelCatalogue';

export const candidateIdentity = (productId: string, variationId: string | null) =>
  `${productId}::${variationId ?? ''}`;

function mappingSelections(catalogue: DeliveryChannelCatalogue): Record<string, string> {
  return Object.fromEntries(
    catalogue.items.map((item) => [
      item.providerItemId,
      item.productId ? candidateIdentity(item.productId, item.variationId) : '',
    ]),
  );
}

function parseIdentity(value: string): { productId: string; variationId: string | null } | null {
  const split = value.lastIndexOf('::');
  return split < 1 ? null : { productId: value.slice(0, split), variationId: value.slice(split + 2) || null };
}

export function useDeliveryChannelCatalogue() {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState<DeliveryChannelCatalogue | null>(null);
  const [candidates, setCandidates] = useState<readonly DeliveryChannelCatalogueCandidate[]>([]);
  const [candidateCursor, setCandidateCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'search' | null>(null);
  const [error, setError] = useState<DeliveryChannelMutationFailure | 'load' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [writeUncertain, setWriteUncertain] = useState(false);
  const candidateRequest = useRef(0);
  const catalogueRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++catalogueRequest.current;
    setError(null);
    setErrorMessage(null);
    try {
      const result = await deliveryChannelManagementService.getCatalogue();
      if (requestId !== catalogueRequest.current) return false;
      setCatalogue(result);
      setSelected(mappingSelections(result));
      setSelectionVersion((current) => current + 1);
      setStale(false);
      setErrorMessage(null);
      setWriteUncertain(false);
      return true;
    } catch (cause) {
      if (requestId === catalogueRequest.current) {
        setStale(true);
        setError('load');
        setErrorMessage(routeApiError(cause).rootMessage ?? t('deliveryChannels.errors.load'));
      }
      return false;
    } finally {
      if (requestId === catalogueRequest.current) setLoading(false);
    }
  }, [t]);

  const searchCandidates = useCallback(
    async (search: string, cursor: string | null = null) => {
      const requestId = ++candidateRequest.current;
      setBusy('search');
      setError(null);
      setErrorMessage(null);
      try {
        const result = await deliveryChannelManagementService.getCandidates(search, cursor);
        if (requestId !== candidateRequest.current) return null;
        setCandidates((current) => (cursor ? [...current, ...result.items] : result.items));
        setCandidateCursor(result.nextCursor);
        setError(null);
        setErrorMessage(null);
        return result;
      } catch (cause) {
        if (requestId === candidateRequest.current) {
          setError('load');
          setErrorMessage(routeApiError(cause).rootMessage ?? t('deliveryChannels.errors.load'));
        }
        return null;
      } finally {
        if (requestId === candidateRequest.current) setBusy((current) => (current === 'search' ? null : current));
      }
    },
    [t],
  );

  useEffect(() => {
    void Promise.all([refresh(), searchCandidates('', null)]);
  }, [refresh, searchCandidates]);

  const choose = useCallback((providerItemId: string, value: string) => {
    setSelected((current) => ({ ...current, [providerItemId]: value }));
    setSelectionVersion((current) => current + 1);
  }, []);

  const duplicateSelection = useMemo(() => {
    const identities = Object.values(selected).filter(Boolean);
    return new Set(identities).size !== identities.length;
  }, [selected]);
  const dirty = Boolean(
    catalogue &&
    (!catalogue.draftRevision || JSON.stringify(selected) !== JSON.stringify(mappingSelections(catalogue))),
  );

  const saveDraft = useCallback(async () => {
    if (!catalogue || !dirty || duplicateSelection || writeUncertain || stale) return false;
    const items = Object.entries(selected).flatMap(([providerItemId, value]) => {
      const identity = parseIdentity(value);
      return identity ? [{ providerItemId, ...identity }] : [];
    });
    setBusy('save');
    setError(null);
    setErrorMessage(null);
    try {
      const result: DeliveryChannelCatalogueDraft = await deliveryChannelManagementService.saveDraft({
        expectedDraftRevision: catalogue.draftRevision || null,
        items,
      });
      setCatalogue((current) =>
        current
          ? {
              ...current,
              draftRevision: result.draftRevision,
              mappingRevision: result.mappingRevision,
              items: result.items,
            }
          : current,
      );
      setSelected(mappingSelections({ ...catalogue, items: result.items }));
      setSelectionVersion((current) => current + 1);
      setWriteUncertain(false);
      setErrorMessage(null);
      return true;
    } catch (cause) {
      const classified = classifyDeliveryChannelMutationFailure(cause);
      setError(classified);
      if (classified === 'stale' || classified === 'uncertain') {
        if (classified === 'uncertain') setWriteUncertain(true);
        setStale(true);
        const confirmedByReadback = await refresh();
        if (classified === 'uncertain' && confirmedByReadback) {
          setWriteUncertain(false);
          setError(null);
        } else {
          setError(classified);
        }
      }
      return false;
    } finally {
      setBusy(null);
    }
  }, [catalogue, dirty, duplicateSelection, refresh, selected, stale, writeUncertain]);

  return {
    catalogue,
    candidates,
    candidateCursor,
    selected,
    selectionVersion,
    loading,
    busy,
    error,
    errorMessage,
    stale,
    dirty,
    duplicateSelection,
    writeUncertain,
    canReview: Boolean(catalogue),
    refresh,
    searchCandidates,
    choose,
    saveDraft,
  };
}
