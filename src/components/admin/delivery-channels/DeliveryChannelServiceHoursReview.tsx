'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelServiceHoursDay } from '@/types/deliveryChannelCatalogue';
import styles from './DeliveryChannelServiceHoursReview.module.css';

type HoursStatus = 'reviewedTemplate' | 'currentReadback' | 'lastConfirmed' | 'unknown';

interface Props {
  readonly kind: 'planned' | 'provider';
  readonly days: readonly DeliveryChannelServiceHoursDay[];
  readonly status: HoursStatus;
  readonly editable?: boolean;
}

export default function DeliveryChannelServiceHoursReview({ kind, days, status, editable = false }: Readonly<Props>) {
  const { t } = useTranslation();
  const planned = kind === 'planned';
  const statusTone =
    status === 'reviewedTemplate' || status === 'currentReadback'
      ? 'success'
      : status === 'lastConfirmed'
        ? 'warning'
        : 'neutral';

  return (
    <section
      className={styles.hoursReview}
      aria-label={t(planned ? 'deliveryChannels.menu.hoursToPublish' : 'deliveryChannels.menu.currentUberHours')}
    >
      <div className={styles.hoursHeading}>
        <div>
          <h3>{t(planned ? 'deliveryChannels.menu.hoursToPublish' : 'deliveryChannels.menu.currentUberHours')}</h3>
          <p>{t(planned ? 'deliveryChannels.menu.outgoingHoursNote' : 'deliveryChannels.menu.currentHoursNote')}</p>
        </div>
        <StatusBadge tone={statusTone}>{t(`deliveryChannels.menu.provenance.${status}`)}</StatusBadge>
      </div>
      {planned && (
        <p className={styles.hoursReadonly}>
          {t(editable ? 'deliveryChannels.menu.hoursEditable' : 'deliveryChannels.menu.hoursReadOnly')}
        </p>
      )}
      {days.length === 0 ? (
        <p role="status">
          {t(
            planned
              ? 'deliveryChannels.menu.outgoingHoursUnavailable'
              : 'deliveryChannels.menu.currentHoursUnavailable',
          )}
        </p>
      ) : (
        <ul className={styles.hoursGrid}>
          {days.map((day) => (
            <li key={day.dayOfWeek}>
              <strong>
                {t(`deliveryChannels.weekdays.${day.dayOfWeek.toLowerCase()}`, { defaultValue: day.dayOfWeek })}
              </strong>
              <span>
                {day.timePeriods.length
                  ? day.timePeriods.map((period) => `${period.startTime}–${period.endTime}`).join(', ')
                  : t('deliveryChannels.menu.closed')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
