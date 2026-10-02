'use client';

import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { DeliveryChannelAvailability } from '@/types/deliveryChannelManagement';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import DeliveryChannelAvailabilityItems from './DeliveryChannelAvailabilityItems';
import DeliveryChannelAvailabilityConfirmationModal from './DeliveryChannelAvailabilityConfirmationModal';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly connected: boolean;
  readonly supported: boolean;
  readonly paused: boolean;
  readonly availability: DeliveryChannelAvailability | null;
  readonly stale: boolean;
  readonly locale: string;
  readonly busy: string | null;
  readonly canWrite: boolean;
  readonly statusCheckRequired: boolean;
  readonly feedback: DeliveryChannelOperationFeedback | null;
  readonly onPause: (duration: 15 | 30 | 60 | 240 | null) => Promise<void>;
  readonly onResume: () => Promise<void>;
  readonly onReadStatus: () => Promise<boolean>;
  readonly onConnect: () => void;
}

type PauseDuration = '15' | '30' | '60' | '240' | 'indefinite';
type ConfirmAction = 'pause' | 'resume';

function durationLabel(value: PauseDuration, t: TFunction): string {
  if (value === 'indefinite') return t('deliveryChannels.availability.indefinite');
  if (value === '240') return t('deliveryChannels.availability.hours', { count: 4 });
  return t('deliveryChannels.availability.minutes', { count: Number(value) });
}

export default function DeliveryChannelAvailabilityControls({
  connected,
  supported,
  paused,
  availability,
  stale,
  locale,
  busy,
  canWrite,
  statusCheckRequired,
  feedback,
  onPause,
  onResume,
  onReadStatus,
  onConnect,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState<PauseDuration>('30');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [checking, setChecking] = useState(false);

  const confirm = async () => {
    if (!confirmAction || !connected || !canWrite || stale || busy === 'availability') return;
    try {
      if (confirmAction === 'pause')
        await onPause(duration === 'indefinite' ? null : (Number(duration) as 15 | 30 | 60 | 240));
      if (confirmAction === 'resume') await onResume();
    } finally {
      setConfirmAction(null);
    }
  };

  const readStatus = async () => {
    if (checking || busy !== null) return;
    setChecking(true);
    try {
      await onReadStatus();
    } finally {
      setChecking(false);
    }
  };

  if (!connected) {
    return (
      <div className={styles.notice}>
        <p>{t('deliveryChannels.workspace.connectFirstBody')}</p>
        <button className={styles.textAction} type="button" onClick={onConnect}>
          {t('deliveryChannels.workspace.connectFirstAction')}
        </button>
      </div>
    );
  }

  if (!supported) return <p className={styles.notice}>{t('deliveryChannels.availability.unsupported')}</p>;

  return (
    <>
      <div className={styles.controls}>
        {paused ? (
          <button
            className={styles.action}
            type="button"
            onClick={() => setConfirmAction('resume')}
            disabled={!canWrite || stale || busy !== null}
          >
            {t('deliveryChannels.availability.resume')}
          </button>
        ) : (
          <>
            <FormField label={t('deliveryChannels.availability.pauseDuration')}>
              <select
                value={duration}
                onChange={(event) => setDuration(event.target.value as PauseDuration)}
                disabled={!canWrite || stale}
              >
                <option value="15">{t('deliveryChannels.availability.minutes', { count: 15 })}</option>
                <option value="30">{t('deliveryChannels.availability.minutes', { count: 30 })}</option>
                <option value="60">{t('deliveryChannels.availability.minutes', { count: 60 })}</option>
                <option value="240">{t('deliveryChannels.availability.hours', { count: 4 })}</option>
                <option value="indefinite">{t('deliveryChannels.availability.indefinite')}</option>
              </select>
            </FormField>
            <button
              className={styles.pauseButton}
              type="button"
              onClick={() => setConfirmAction('pause')}
              disabled={!canWrite || stale || busy !== null}
            >
              {t('deliveryChannels.availability.pause')}
            </button>
          </>
        )}
      </div>
      <p className={styles.checkedAt}>
        {t('deliveryChannels.lastChecked', {
          time: formatDeliveryChannelDate(
            availability?.checkedAt ?? null,
            locale,
            t('deliveryChannels.timeUnavailable'),
          ),
        })}
        {availability?.pausedUntil &&
          ` · ${t('deliveryChannels.availability.pauseEnds', { time: formatDeliveryChannelDate(availability.pausedUntil, locale, t('deliveryChannels.timeUnavailable')) })}`}
      </p>
      {stale && (
        <p className={styles.notice}>
          <output>{t('deliveryChannels.stale')}</output>
        </p>
      )}
      {statusCheckRequired && (
        <div className={styles.notice} role="alert">
          <p>{t('deliveryChannels.operations.statusCheckRequired')}</p>
          <button
            className={styles.textAction}
            type="button"
            onClick={() => void readStatus()}
            disabled={checking || busy !== null}
          >
            {checking ? t('deliveryChannels.loading') : t('deliveryChannels.refreshStatus')}
          </button>
        </div>
      )}
      {feedback?.kind === 'availability' && (
        <p className={feedback.outcome === 'confirmed' ? styles.success : styles.warning}>
          <output>{t(`deliveryChannels.operations.${feedback.outcome}`)}</output>
        </p>
      )}
      <DeliveryChannelAvailabilityItems items={availability?.items ?? []} locale={locale} stale={stale} />
      <DeliveryChannelAvailabilityConfirmationModal
        action={confirmAction}
        busy={busy}
        connected={connected}
        canWrite={canWrite}
        duration={durationLabel(duration, t)}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirm}
      />
    </>
  );
}
