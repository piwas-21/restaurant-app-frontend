'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classifyDeliveryChannelMutationFailure,
  deliveryChannelManagementService,
  type DeliveryChannelMutationFailure,
} from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelPreview,
  DeliveryChannelPublication,
} from '@/types/deliveryChannelCatalogue';
import {
  pollPendingPublication,
  publicationHasCurrentTaxProfile,
  publicationRequiresTaxProfile,
  publishIsBlocked,
} from '@/utils/deliveryChannelPublicationFlow';
import { useDeliveryChannelPublicationStatus } from './useDeliveryChannelPublicationStatus';

interface Props {
  readonly catalogue: DeliveryChannelCatalogue | null;
  readonly selectionVersion: number;
  readonly dirty: boolean;
  readonly stale: boolean;
  readonly draftWriteUncertain: boolean;
  readonly refreshCatalogue: () => Promise<boolean>;
}

export function useDeliveryChannelPublication({
  catalogue,
  selectionVersion,
  dirty,
  stale,
  draftWriteUncertain,
  refreshCatalogue,
}: Readonly<Props>) {
  const [preview, setPreview] = useState<DeliveryChannelPreview | null>(null);
  const [publication, setPublication] = useState<DeliveryChannelPublication | null>(null);
  const [busy, setBusy] = useState<'preview' | 'publish' | null>(null);
  const [error, setError] = useState<DeliveryChannelMutationFailure | 'load' | null>(null);
  const [writeUncertain, setWriteUncertain] = useState(false);
  const status = useDeliveryChannelPublicationStatus({
    catalogue,
    publication,
    writeUncertain,
    setPublication,
    setWriteUncertain,
    setError,
    refreshCatalogue,
  });
  const { checking, requestError, refreshPublication, rememberPublishedId } = status;

  useEffect(() => setPreview(null), [catalogue, selectionVersion]);

  const unresolvedPublication = useMemo(() => {
    if (writeUncertain) return true;
    const latest = catalogue?.latestPublication;
    if (!latest) return publication?.state === 'pending' || publication?.state === 'uncertain';
    if (publication?.id !== latest.id) return true;
    return (
      publication.state === 'pending' ||
      publication.state === 'uncertain' ||
      (publication.state === 'verified' && !publication.providerReadbackVerified)
    );
  }, [catalogue?.latestPublication, publication, writeUncertain]);

  const createPreview = useCallback(async () => {
    if (!catalogue || dirty || stale || draftWriteUncertain || writeUncertain) return null;
    setBusy('preview');
    setError(null);
    try {
      const result = await deliveryChannelManagementService.preview({ draftRevision: catalogue.draftRevision });
      setPreview(result);
      return result;
    } catch (cause) {
      const classified = classifyDeliveryChannelMutationFailure(cause);
      setError(classified);
      if (classified === 'stale') await refreshCatalogue();
      return null;
    } finally {
      setBusy(null);
    }
  }, [catalogue, dirty, draftWriteUncertain, refreshCatalogue, stale, writeUncertain]);

  const publish = useCallback(
    async (confirmedTaxProfile = false) => {
      if (
        !catalogue ||
        !preview ||
        publishIsBlocked({
          catalogue,
          preview,
          confirmedTaxProfile,
          dirty,
          stale,
          unresolvedPublication,
          draftWriteUncertain,
          writeUncertain,
        })
      )
        return null;
      const requiresTaxProfile = publicationRequiresTaxProfile(preview);
      const taxProfileRevision = preview.taxProfileRevision;
      setBusy('publish');
      setError(null);
      try {
        const result = await deliveryChannelManagementService.publish({
          draftRevision: preview.draftRevision,
          publicationRevision: preview.publicationRevision,
          ...(requiresTaxProfile && taxProfileRevision ? { confirmedTaxProfile: true, taxProfileRevision } : {}),
        });
        rememberPublishedId(result.id);
        setPublication(result);
        if (result.state === 'verified' && result.providerReadbackVerified) {
          setWriteUncertain(false);
          await refreshCatalogue();
        }
        if (result.state === 'pending') {
          const polled = await pollPendingPublication(refreshPublication);
          if (polled.finished) return polled.publication;
        }
        return result;
      } catch (cause) {
        const classified = classifyDeliveryChannelMutationFailure(cause);
        setError(classified);
        if (classified === 'uncertain') {
          setWriteUncertain(true);
          await refreshCatalogue();
          setError('uncertain');
        } else if (classified === 'stale') {
          await refreshCatalogue();
          setError('stale');
        }
        return null;
      } finally {
        setBusy(null);
      }
    },
    [
      catalogue,
      dirty,
      draftWriteUncertain,
      preview,
      refreshCatalogue,
      stale,
      refreshPublication,
      rememberPublishedId,
      unresolvedPublication,
      writeUncertain,
    ],
  );

  const canPublish = Boolean(
    preview?.canPublish &&
    (!publicationRequiresTaxProfile(preview) || publicationHasCurrentTaxProfile(preview)) &&
    !dirty &&
    !stale &&
    !unresolvedPublication &&
    !draftWriteUncertain &&
    !writeUncertain,
  );
  const verified = publication?.state === 'verified' && publication.providerReadbackVerified;

  return {
    preview,
    publication,
    busy: busy ?? (checking ? 'check' : null),
    error,
    requestError,
    writeUncertain,
    unresolvedPublication,
    canPublish,
    verified,
    refreshPublication,
    createPreview,
    publish,
  };
}
