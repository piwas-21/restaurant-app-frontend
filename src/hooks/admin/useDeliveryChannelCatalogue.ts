'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { mergeDeliveryChannelCandidateCache } from '@/utils/deliveryChannelCandidateCache';
import {
  deliveryChannelDraftStatus,
  deliveryChannelMappingSelections,
  parseDeliveryChannelCandidateIdentity,
} from '@/utils/deliveryChannelDraftMappingState';

export { candidateIdentity } from '@/utils/deliveryChannelCandidateIdentity';

export function useDeliveryChannelCatalogue(enabled = true) {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState<DeliveryChannelCatalogue | null>(null);
  const [candidates, setCandidates] = useState<readonly DeliveryChannelCatalogueCandidate[]>([]);
  const [knownCandidates, setKnownCandidates] = useState<readonly DeliveryChannelCatalogueCandidate[]>([]);
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
  const initialReadState = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refresh = useCallback(async () => {
    if (!enabled) return false;
    const requestId = ++catalogueRequest.current;
    setError(null);
    setErrorMessage(null);
    try {
      const result = await deliveryChannelManagementService.getCatalogue();
      if (requestId !== catalogueRequest.current) return false;
      setCatalogue(result);
      initialReadState.current = 'loaded';
      setSelected(deliveryChannelMappingSelections(result));
      setSelectionVersion((current) => current + 1);
      setStale(false);
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
  }, [enabled, t]);

  const searchCandidates = useCallback(
    async (search: string, cursor: string | null = null) => {
      if (!enabled) return null;
      const requestId = ++candidateRequest.current;
      if (!cursor) {
        setCandidates([]);
        setCandidateCursor(null);
      }
      setBusy('search');
      setError(null);
      setErrorMessage(null);
      try {
        const result = await deliveryChannelManagementService.getCandidates(search, cursor);
        if (requestId !== candidateRequest.current) return null;
        setCandidates((current) => (cursor ? [...current, ...result.items] : result.items));
        setKnownCandidates((current) => mergeDeliveryChannelCandidateCache(current, result.items));
        setCandidateCursor(result.nextCursor);
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
    [enabled, t],
  );

  useEffect(() => {
    if (!enabled) {
      catalogueRequest.current += 1;
      candidateRequest.current += 1;
      setLoading(false);
      setBusy(null);
      if (initialReadState.current === 'loaded') setStale(true);
      else initialReadState.current = 'idle';
      return;
    }
    if (initialReadState.current !== 'loaded') {
      if (initialReadState.current === 'loading') return;
      initialReadState.current = 'loading';
      setLoading(true);
      void Promise.all([refresh(), searchCandidates('', null)]);
      return;
    }
    setStale(true);
    void searchCandidates('', null);
  }, [enabled, refresh, searchCandidates]);

  const choose = (providerItemId: string, value: string) => {
    if (!enabled) return;
    setSelected((current) => ({ ...current, [providerItemId]: value }));
    setSelectionVersion((current) => current + 1);
  };

  const { duplicateSelection, dirty } = deliveryChannelDraftStatus(catalogue, selected);

  const saveDraft = useCallback(async () => {
    if (!enabled || !catalogue || !dirty || duplicateSelection || writeUncertain || stale) return false;
    const items = Object.entries(selected).flatMap(([providerItemId, value]) => {
      const identity = parseDeliveryChannelCandidateIdentity(value);
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
      setSelected(deliveryChannelMappingSelections({ ...catalogue, items: result.items }));
      setSelectionVersion((current) => current + 1);
      setWriteUncertain(false);
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
  }, [catalogue, dirty, duplicateSelection, enabled, refresh, selected, stale, writeUncertain]);

  return {
    catalogue,
    candidates,
    knownCandidates,
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
    refresh,
    searchCandidates,
    choose,
    saveDraft,
  };
}
