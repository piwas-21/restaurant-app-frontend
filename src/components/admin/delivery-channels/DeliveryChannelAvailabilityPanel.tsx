'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelAvailability, DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import DeliveryChannelAvailabilityControls from './DeliveryChannelAvailabilityControls';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly availability: DeliveryChannelAvailability | null;
  readonly stale: boolean;
  readonly locale: string;
  readonly connected: boolean;
  readonly busy: string | null;
  readonly canWrite: boolean;
  readonly statusCheckRequired: boolean;
  readonly feedback: DeliveryChannelOperationFeedback | null;
  readonly onPause: (duration: 15 | 30 | 60 | 240 | null) => Promise<void>;
  readonly onResume: () => Promise<void>;
  readonly onReadStatus: () => Promise<boolean>;
  readonly onConnect: () => void;
  readonly itemLabels?: ReadonlyMap<string, string>;
}

function statusKey(connected: boolean, paused: boolean): string {
  if (!connected) return 'deliveryChannels.connection.notConnected';
  return `deliveryChannels.availability.${paused ? 'paused' : 'live'}`;
}

function statusTone(connected: boolean, paused: boolean): 'success' | 'warning' | 'neutral' {
  if (!connected) return 'neutral';
  return paused ? 'warning' : 'success';
}

export default function DeliveryChannelAvailabilityPanel({
  summary,
  availability,
  stale,
  locale,
  connected,
  busy,
  canWrite,
  statusCheckRequired,
  feedback,
  onPause,
  onResume,
  onReadStatus,
  onConnect,
  itemLabels,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const paused = availability?.paused ?? summary.paused;

  return (
    <section className={styles.panel} aria-labelledby="delivery-channel-availability-title">
      <div className={styles.heading}>
        <div>
          <h2 id="delivery-channel-availability-title" className={styles.title}>
            {t('deliveryChannels.availability.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.availability.description')}</p>
        </div>
        <StatusBadge tone={statusTone(connected, paused)}>{t(statusKey(connected, paused))}</StatusBadge>
      </div>
      <DeliveryChannelAvailabilityControls
        connected={connected}
        supported={summary.capabilities.supportsItemAvailability}
        paused={paused}
        availability={availability}
        stale={stale}
        locale={locale}
        busy={busy}
        canWrite={canWrite}
        statusCheckRequired={statusCheckRequired}
        feedback={feedback}
        onPause={onPause}
        onResume={onResume}
        onReadStatus={onReadStatus}
        onConnect={onConnect}
        itemLabels={itemLabels}
      />
    </section>
  );
}
