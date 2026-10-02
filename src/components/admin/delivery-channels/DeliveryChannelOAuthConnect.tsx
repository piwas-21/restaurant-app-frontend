'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deliveryChannelManagementService,
  isSafeUberAuthorizationUrl,
  classifyDeliveryChannelMutationFailure,
} from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelConnectionPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly locale: string;
  readonly canWrite: boolean;
  readonly menuProviderVerified: boolean;
  readonly onRefresh: () => Promise<boolean>;
}

export default function DeliveryChannelOAuthConnect({
  summary,
  locale,
  canWrite,
  menuProviderVerified,
  onRefresh,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [authorization, setAuthorization] = useState<{ url: string; expiresAt: string; enablesOrders: boolean } | null>(
    null,
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<'start' | 'unsafeUrl' | 'uncertain' | null>(null);
  const [startUncertain, setStartUncertain] = useState(false);
  const canConnect = summary.enabled && summary.connectionStatus === 'notConnected';
  const canPrepareOrderAcceptance =
    summary.enabled &&
    summary.connectionStatus === 'connected' &&
    summary.storeConfirmed &&
    summary.requireManualAcceptance;
  const canEnableOrders = canPrepareOrderAcceptance && menuProviderVerified;
  const visible = canConnect || canPrepareOrderAcceptance;

  useEffect(() => {
    if (!authorization) return;
    const delay = Math.max(0, new Date(authorization.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setAuthorization(null), delay);
    return () => window.clearTimeout(timer);
  }, [authorization]);

  const start = async (enableOrderAcceptance: boolean) => {
    if (starting || !canWrite || startUncertain || authorization) return;
    setStarting(true);
    setError(null);
    try {
      const result = await deliveryChannelManagementService.startOAuth(enableOrderAcceptance);
      if (!isSafeUberAuthorizationUrl(result.authorizationUrl)) {
        setError('unsafeUrl');
        return;
      }
      setAuthorization({
        url: result.authorizationUrl,
        expiresAt: result.expiresAt,
        enablesOrders: enableOrderAcceptance,
      });
    } catch (cause) {
      const uncertain = classifyDeliveryChannelMutationFailure(cause) === 'uncertain';
      setError(uncertain ? 'uncertain' : 'start');
      setStartUncertain(uncertain);
    } finally {
      setStarting(false);
    }
  };

  const checkStatus = async () => {
    if (await onRefresh()) {
      setStartUncertain(false);
      setError(null);
    }
  };

  if (!visible && summary.connectionStatus !== 'authorizing') return null;
  if (!visible) {
    return (
      <div className={styles.notice}>
        <p>
          <output>{t('deliveryChannels.connection.authorizationPending')}</output>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.connectArea}>
      <p>
        {t(
          canConnect
            ? 'deliveryChannels.connection.connectExplanation'
            : 'deliveryChannels.connection.manualAcceptanceExplanation',
        )}
      </p>
      {canConnect && (
        <button
          className={workspaceStyles.action}
          type="button"
          onClick={() => void start(false)}
          disabled={starting || !canWrite || startUncertain || Boolean(authorization)}
        >
          {starting ? t('deliveryChannels.loading') : t('deliveryChannels.connection.start')}
        </button>
      )}
      {!canConnect && !menuProviderVerified && (
        <p className={styles.notice}>{t('deliveryChannels.connection.publishBeforeOrders')}</p>
      )}
      {canEnableOrders && (
        <button
          className={workspaceStyles.action}
          type="button"
          onClick={() => void start(true)}
          disabled={starting || !canWrite || startUncertain || Boolean(authorization)}
        >
          {starting ? t('deliveryChannels.loading') : t('deliveryChannels.connection.enableOrders')}
        </button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {t(`deliveryChannels.connection.errors.${error}`)}
          {error === 'uncertain' && (
            <button className={styles.inlineAction} type="button" onClick={() => void checkStatus()}>
              {t('deliveryChannels.refreshStatus')}
            </button>
          )}
        </p>
      )}
      {authorization && (
        <div className={styles.authorization}>
          <p>
            <output>
              {t(
                authorization.enablesOrders
                  ? 'deliveryChannels.connection.providerStepEnableOrders'
                  : 'deliveryChannels.connection.providerStep',
              )}
            </output>
          </p>
          <a href={authorization.url} target="_blank" rel="noreferrer noopener">
            {t('deliveryChannels.connection.openProvider')}
          </a>
          <p className={styles.checkedAt}>
            <output>
              {t('deliveryChannels.connection.linkExpires', {
                time: formatDeliveryChannelDate(authorization.expiresAt, locale, t('deliveryChannels.timeUnavailable')),
              })}
            </output>
          </p>
        </div>
      )}
    </div>
  );
}
