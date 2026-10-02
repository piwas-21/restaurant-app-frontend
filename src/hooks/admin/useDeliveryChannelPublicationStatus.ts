'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { routeApiError } from '@/utils/apiFormErrors';
import {
  deliveryChannelManagementService,
  type DeliveryChannelMutationFailure,
} from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelCatalogue, DeliveryChannelPublication } from '@/types/deliveryChannelCatalogue';

interface Props {
  readonly catalogue: DeliveryChannelCatalogue | null;
  readonly publication: DeliveryChannelPublication | null;
  readonly writeUncertain: boolean;
  readonly setPublication: Dispatch<SetStateAction<DeliveryChannelPublication | null>>;
  readonly setWriteUncertain: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<DeliveryChannelMutationFailure | 'load' | null>>;
  readonly refreshCatalogue: () => Promise<boolean>;
}

function isActivePublication(publication: DeliveryChannelPublication | null): boolean {
  return Boolean(
    publication &&
    (publication.state === 'pending' ||
      publication.state === 'uncertain' ||
      (publication.state === 'verified' && !publication.providerReadbackVerified)),
  );
}

function isTerminalPublication(publication: DeliveryChannelPublication): boolean {
  return ['failed', 'mismatch', 'abandoned'].includes(publication.state);
}

async function resolvePublicationId(
  preferredId: string | null,
  writeUncertain: boolean,
  publication: DeliveryChannelPublication | null,
  latestPublicationId: string | null,
): Promise<string | null> {
  if (preferredId) return preferredId;
  let id: string | null = null;
  if (writeUncertain) id = (await deliveryChannelManagementService.getCatalogue()).latestPublication?.id ?? null;
  if (!id) {
    id = (isActivePublication(publication) ? publication?.id : (latestPublicationId ?? publication?.id)) ?? null;
  }
  if (!id) id = (await deliveryChannelManagementService.getCatalogue()).latestPublication?.id ?? null;
  return id;
}

function markMissingPublication(
  isCurrent: () => boolean,
  setPublication: Dispatch<SetStateAction<DeliveryChannelPublication | null>>,
  setError: Dispatch<SetStateAction<DeliveryChannelMutationFailure | 'load' | null>>,
) {
  if (!isCurrent()) return;
  setPublication(null);
  setError('load');
}

export function useDeliveryChannelPublicationStatus({
  catalogue,
  publication,
  writeUncertain,
  setPublication,
  setWriteUncertain,
  setError,
  refreshCatalogue,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const preferredPublicationId = useRef<string | null>(null);

  const rememberPublishedId = useCallback((id: string) => {
    preferredPublicationId.current = id;
  }, []);

  const refreshPublication = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const isCurrent = () => requestId === requestSequence.current;
    setChecking(true);
    setError(null);
    setRequestError(null);
    try {
      const id = await resolvePublicationId(
        preferredPublicationId.current,
        writeUncertain,
        publication,
        catalogue?.latestPublication?.id ?? null,
      );
      if (!id) {
        markMissingPublication(isCurrent, setPublication, setError);
        return null;
      }

      const current = await deliveryChannelManagementService.getPublication(id);
      if (isCurrent()) {
        setPublication(current);
        setRequestError(null);
        const terminal = isTerminalPublication(current);
        const verified = current.state === 'verified' && current.providerReadbackVerified;
        if (verified || terminal) {
          setWriteUncertain(false);
          if (terminal) preferredPublicationId.current = null;
        }
        if (verified) await refreshCatalogue();
      }
      return current;
    } catch (cause) {
      if (isCurrent()) {
        setError('uncertain');
        setRequestError(routeApiError(cause).rootMessage ?? t('deliveryChannels.errors.uncertain'));
      }
      return null;
    } finally {
      if (isCurrent()) setChecking(false);
    }
  }, [
    catalogue?.latestPublication?.id,
    publication,
    refreshCatalogue,
    setError,
    setPublication,
    setWriteUncertain,
    writeUncertain,
    t,
  ]);

  const refreshPublicationRef = useRef(refreshPublication);
  refreshPublicationRef.current = refreshPublication;

  useEffect(() => {
    if (preferredPublicationId.current && catalogue?.latestPublication?.id === preferredPublicationId.current) {
      preferredPublicationId.current = null;
    }
    if (catalogue?.latestPublication?.id) void refreshPublicationRef.current();
  }, [catalogue?.latestPublication?.id]);

  return { checking, requestError, refreshPublication, rememberPublishedId };
}
