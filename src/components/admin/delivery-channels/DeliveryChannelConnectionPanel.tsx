'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import DeliveryChannelDisconnectAction from './DeliveryChannelDisconnectAction';
import DeliveryChannelOAuthConnect from './DeliveryChannelOAuthConnect';
import styles from './DeliveryChannelConnectionPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly locale: string;
  readonly busy: string | null;
  readonly canWrite: boolean;
  readonly menuProviderVerified: boolean;
  readonly feedback: DeliveryChannelOperationFeedback | null;
  readonly onDisconnect: (storeId: string) => Promise<void>;
  readonly onRefresh: () => Promise<boolean>;
}

function healthTone(
  status: DeliveryChannelManagementSummary['healthStatus'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'unavailable') return 'danger';
  return 'neutral';
}

function connectionTone(summary: DeliveryChannelManagementSummary): 'success' | 'warning' | 'neutral' {
  if (summary.connectionStatus === 'connected' && summary.storeConfirmed) return 'success';
  if (summary.connectionStatus === 'needsAttention') return 'warning';
  return 'neutral';
}

export default function DeliveryChannelConnectionPanel({
  summary,
  locale,
  busy,
  canWrite,
  menuProviderVerified,
  feedback,
  onDisconnect,
  onRefresh,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const storeConfirmed = summary.storeConfirmed && Boolean(summary.storeId);

  return (
    <section className={styles.panel} aria-labelledby="delivery-channel-connection-title">
      <div className={styles.headingRow}>
        <div>
          <h2 id="delivery-channel-connection-title" className={styles.title}>
            {t('deliveryChannels.connection.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.connection.description')}</p>
        </div>
        <div className={styles.badges}>
          <StatusBadge tone={connectionTone(summary)}>
            {t(`deliveryChannels.connection.${summary.connectionStatus}`)}
          </StatusBadge>
          <StatusBadge tone={healthTone(summary.healthStatus)}>
            {t(`deliveryChannels.health.${summary.healthStatus}`)}
          </StatusBadge>
          {summary.sandboxOnly && <StatusBadge tone="info">{t('deliveryChannels.store.sandbox')}</StatusBadge>}
        </div>
      </div>

      {!summary.enabled ? (
        <output className={styles.notice}>
          <strong>{t('deliveryChannels.connection.notEnabledTitle')}</strong>
          <span>{t('deliveryChannels.connection.notEnabledBody')}</span>
        </output>
      ) : (
        <>
          {storeConfirmed && (
            <dl className={styles.storeIdentity}>
              <div>
                <dt>{t('deliveryChannels.store.confirmedLabel')}</dt>
                <dd>{summary.storeDisplayName || t('deliveryChannels.store.nameUnavailable')}</dd>
              </div>
              <div>
                <dt>{t('deliveryChannels.store.idLabel')}</dt>
                <dd>
                  <code dir="ltr">{summary.storeId}</code>
                </dd>
              </div>
              <div>
                <dt>{t('deliveryChannels.store.confirmationLabel')}</dt>
                <dd>{t('deliveryChannels.store.confirmedByProvider')}</dd>
              </div>
            </dl>
          )}
          {summary.connectionStatus === 'connected' && !storeConfirmed && (
            <div className={`${styles.notice} ${styles.warning}`}>
              <p>
                <output>{t('deliveryChannels.store.unconfirmed')}</output>
              </p>
            </div>
          )}
          {summary.degradedReason && (
            <div className={`${styles.notice} ${styles.warning}`}>
              <p>
                {t('deliveryChannels.health.degradedReason')}:{' '}
                {t(`deliveryChannels.codes.${summary.degradedReason}`, {
                  defaultValue: t('deliveryChannels.codes.generic'),
                })}
              </p>
            </div>
          )}
          <p className={styles.checkedAt}>
            {t('deliveryChannels.lastChecked', {
              time: formatDeliveryChannelDate(summary.checkedAt, locale, t('deliveryChannels.timeUnavailable')),
            })}
          </p>
          <DeliveryChannelOAuthConnect
            summary={summary}
            locale={locale}
            canWrite={canWrite}
            menuProviderVerified={menuProviderVerified}
            onRefresh={onRefresh}
          />
          <DeliveryChannelDisconnectAction
            summary={summary}
            busy={busy}
            canWrite={canWrite}
            feedback={feedback}
            onDisconnect={onDisconnect}
          />
        </>
      )}
    </section>
  );
}
