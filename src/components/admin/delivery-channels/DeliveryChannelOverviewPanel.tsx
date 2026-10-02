'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelException } from '@/types/deliveryChannelExceptions';
import type {
  DeliveryChannelManagementSummary,
  DeliveryChannelPublicationSummary,
} from '@/types/deliveryChannelManagement';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import type { DeliveryChannelWorkspaceSectionId } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import detailsStyles from './DeliveryChannelTechnicalDetails.module.css';
import styles from './DeliveryChannelOverviewPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly exceptions: readonly DeliveryChannelException[];
  readonly checkedAt: string | null;
  readonly stale: boolean;
  readonly locale: string;
  readonly onNavigate: (section: DeliveryChannelWorkspaceSectionId) => void;
}

function connectionTone(summary: DeliveryChannelManagementSummary): 'success' | 'warning' | 'neutral' {
  if (summary.connectionStatus === 'connected' && summary.storeConfirmed) return 'success';
  if (summary.connectionStatus === 'needsAttention') return 'warning';
  return 'neutral';
}

function healthTone(
  status: DeliveryChannelManagementSummary['healthStatus'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'unavailable') return 'danger';
  return 'neutral';
}

function publicationTone(
  state: DeliveryChannelPublicationSummary['state'] | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'verified') return 'success';
  if (state === 'pending' || state === 'uncertain') return 'warning';
  if (state === 'failed' || state === 'mismatch') return 'danger';
  return 'neutral';
}

export default function DeliveryChannelOverviewPanel({
  summary,
  exceptions,
  checkedAt,
  stale,
  locale,
  onNavigate,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const activeException = exceptions.some((item) => item.status === 'open');
  const storeName = summary.storeDisplayName?.trim() || t('deliveryChannels.store.nameUnavailable');
  const latestPublication = summary.latestPublication;
  const publicationStatus = latestPublication
    ? `deliveryChannels.publication.status.${latestPublication.state}`
    : 'deliveryChannels.publication.notPublished';

  return (
    <section className={styles.panel} aria-labelledby="delivery-channel-overview-title">
      <div className={styles.heading}>
        <div>
          <h2 id="delivery-channel-overview-title" className={styles.title}>
            {t('deliveryChannels.workspace.overviewTitle')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.workspace.overviewBody')}</p>
        </div>
        {summary.sandboxOnly && <StatusBadge tone="info">{t('deliveryChannels.store.sandbox')}</StatusBadge>}
      </div>

      {activeException && (
        <section className={styles.attention} role="alert" aria-labelledby="delivery-channel-attention-title">
          <div>
            <strong id="delivery-channel-attention-title">{t('deliveryChannels.workspace.attentionTitle')}</strong>
            <p>{t('deliveryChannels.workspace.attentionBody')}</p>
          </div>
          <button type="button" onClick={() => onNavigate('exceptions')}>
            {t('deliveryChannels.workspace.openExceptions')}
          </button>
        </section>
      )}

      <div className={styles.store}>
        <div>
          <span>{t('deliveryChannels.store.confirmedLabel')}</span>
          <strong>{summary.storeConfirmed ? storeName : t('deliveryChannels.store.unconfirmed')}</strong>
        </div>
        <div>
          <output>
            {t('deliveryChannels.lastChecked', {
              time: formatDeliveryChannelDate(checkedAt, locale, t('deliveryChannels.timeUnavailable')),
            })}
          </output>
          {stale && <StatusBadge tone="warning">{t('deliveryChannels.stale')}</StatusBadge>}
        </div>
        {summary.storeConfirmed && summary.storeId && (
          <details className={detailsStyles.details}>
            <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
            <dl>
              <div>
                <dt>{t('deliveryChannels.store.idLabel')}</dt>
                <dd>
                  <code dir="ltr">{summary.storeId}</code>
                </dd>
              </div>
            </dl>
          </details>
        )}
      </div>

      <div className={styles.statuses}>
        <div className={styles.statusRow}>
          <h3>{t('deliveryChannels.connection.title')}</h3>
          <StatusBadge tone={connectionTone(summary)}>
            {t(`deliveryChannels.connection.${summary.connectionStatus}`)}
          </StatusBadge>
          <button type="button" onClick={() => onNavigate('connection')}>
            {t('deliveryChannels.workspace.reviewConnection')}
          </button>
        </div>
        <div className={styles.statusRow}>
          <h3>{t('deliveryChannels.workspace.overviewHealth')}</h3>
          <StatusBadge tone={healthTone(summary.healthStatus)}>
            {t(`deliveryChannels.health.${summary.healthStatus}`)}
          </StatusBadge>
          <button type="button" onClick={() => onNavigate('connection')}>
            {t('deliveryChannels.workspace.viewHealth')}
          </button>
        </div>
        <div className={styles.statusRow}>
          <h3>{t('deliveryChannels.publication.title')}</h3>
          <StatusBadge tone={publicationTone(latestPublication?.state ?? null)}>{t(publicationStatus)}</StatusBadge>
          <button type="button" onClick={() => onNavigate('publish')}>
            {t('deliveryChannels.workspace.viewPublication')}
          </button>
        </div>
        <div className={styles.statusRow}>
          <h3>{t('deliveryChannels.availability.title')}</h3>
          <StatusBadge tone={summary.paused ? 'warning' : 'success'}>
            {t(summary.paused ? 'deliveryChannels.availability.paused' : 'deliveryChannels.availability.live')}
          </StatusBadge>
          <button type="button" onClick={() => onNavigate('availability')}>
            {t('deliveryChannels.workspace.manageAvailability')}
          </button>
        </div>
      </div>
    </section>
  );
}
