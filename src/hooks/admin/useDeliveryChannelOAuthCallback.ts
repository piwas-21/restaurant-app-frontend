'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routeApiError } from '@/utils/apiFormErrors';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelOAuthFlow } from '@/types/deliveryChannelManagement';

export type OAuthCallbackState =
  'checking' | 'pending' | 'connected' | 'failed' | 'expired' | 'invalid' | 'unconfirmed' | 'error';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useDeliveryChannelOAuthCallback(flowId: string | null) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<DeliveryChannelOAuthFlow | null>(null);
  const [state, setState] = useState<OAuthCallbackState>(flowId ? 'checking' : 'invalid');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!flowId || !GUID.test(flowId)) {
      setState('invalid');
      return;
    }
    let active = true;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const result = await deliveryChannelManagementService.getOAuthFlow(flowId);
        if (!active) return;
        setErrorMessage(null);
        setFlow(result);
        if (result.status === 'connected') {
          setState(result.storeConfirmed ? 'connected' : 'unconfirmed');
          return;
        }
        if (result.status === 'failed' || result.status === 'expired') {
          setState(result.status);
          return;
        }
        if (new Date(result.expiresAt).getTime() <= Date.now()) {
          setState('expired');
          return;
        }
        setState('pending');
        timer = window.setTimeout(() => void poll(), 2_000);
      } catch (cause) {
        if (active) {
          setState('error');
          setErrorMessage(routeApiError(cause).rootMessage ?? t('deliveryChannels.callback.message.error'));
        }
      }
    };

    setState('checking');
    void poll();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [attempt, flowId, t]);

  return { flow, state, errorMessage, retry: () => setAttempt((current) => current + 1) };
}
