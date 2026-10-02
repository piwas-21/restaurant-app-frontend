'use client';

import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelAvailability, DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import DeliveryChannelAvailabilityItems from './DeliveryChannelAvailabilityItems';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
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
}

function durationLabel(value: '15' | '30' | '60' | '240' | 'indefinite', t: TFunction): string {
  if (value === 'indefinite') return t('deliveryChannels.availability.indefinite');
  if (value === '240') return t('deliveryChannels.availability.hours', { count: 4 });
  return t('deliveryChannels.availability.minutes', { count: Number(value) });
}

export default function DeliveryChannelAvailabilityPanel({
  summary,
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
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState<'15' | '30' | '60' | '240' | 'indefinite'>('30');
  const [confirmAction, setConfirmAction] = useState<'pause' | 'resume' | null>(null);
  const [checking, setChecking] = useState(false);
  const supported = summary.capabilities.supportsItemAvailability;
  const paused = availability?.paused ?? summary.paused;

  const confirm = async () => {
    if (confirmAction === 'pause')
      await onPause(duration === 'indefinite' ? null : (Number(duration) as 15 | 30 | 60 | 240));
    if (confirmAction === 'resume') await onResume();
    setConfirmAction(null);
  };

  const readStatus = async () => {
    setChecking(true);
    await onReadStatus();
    setChecking(false);
  };

  return (
    <section className={styles.panel} aria-labelledby="delivery-channel-availability-title">
      <div className={styles.heading}>
        <div>
          <h2 id="delivery-channel-availability-title" className={styles.title}>
            {t('deliveryChannels.availability.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.availability.description')}</p>
        </div>
        <StatusBadge tone={paused ? 'warning' : 'success'}>
          {t(paused ? 'deliveryChannels.availability.paused' : 'deliveryChannels.availability.live')}
        </StatusBadge>
      </div>

      {!supported ? (
        <p className={styles.notice}>{t('deliveryChannels.availability.unsupported')}</p>
      ) : (
        <>
          <div className={styles.controls}>
            {!paused ? (
              <>
                <FormField label={t('deliveryChannels.availability.pauseDuration')}>
                  <select
                    value={duration}
                    onChange={(event) => setDuration(event.target.value as typeof duration)}
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
            ) : (
              <button
                className={styles.action}
                type="button"
                onClick={() => setConfirmAction('resume')}
                disabled={!canWrite || stale || busy !== null}
              >
                {t('deliveryChannels.availability.resume')}
              </button>
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
            <p className={styles.notice} role="status">
              {t('deliveryChannels.stale')}
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
            <p className={feedback.outcome === 'confirmed' ? styles.success : styles.warning} role="status">
              {t(`deliveryChannels.operations.${feedback.outcome}`)}
            </p>
          )}
          <DeliveryChannelAvailabilityItems items={availability?.items ?? []} locale={locale} stale={stale} />
        </>
      )}

      <BaseModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={t(
          confirmAction === 'pause'
            ? 'deliveryChannels.availability.pauseConfirmTitle'
            : 'deliveryChannels.availability.resumeConfirmTitle',
        )}
        presentation="responsive-sheet"
        isPending={busy === 'availability'}
        footer={
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setConfirmAction(null)}
              disabled={busy === 'availability'}
            >
              {t('deliveryChannels.cancel')}
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => void confirm()}
              disabled={!canWrite || busy === 'availability'}
            >
              {busy === 'availability'
                ? t('deliveryChannels.loading')
                : t(
                    confirmAction === 'pause'
                      ? 'deliveryChannels.availability.pause'
                      : 'deliveryChannels.availability.resume',
                  )}
            </button>
          </div>
        }
      >
        <div className={styles.modalBody}>
          <p>{t('deliveryChannels.availability.pauseImpact')}</p>
          <p>{t('deliveryChannels.availability.existingOrdersContinue')}</p>
          {confirmAction === 'pause' && (
            <p>{t('deliveryChannels.availability.selectedDuration', { duration: durationLabel(duration, t) })}</p>
          )}
        </div>
      </BaseModal>
    </section>
  );
}
