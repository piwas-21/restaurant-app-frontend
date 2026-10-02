'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelItemAvailability } from '@/types/deliveryChannelManagement';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly items: readonly DeliveryChannelItemAvailability[];
  readonly locale: string;
  readonly stale: boolean;
}

export default function DeliveryChannelAvailabilityItems({ items, locale, stale }: Readonly<Props>) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <ul className={styles.items}>
      {items.map((item) => {
        const state =
          item.confirmedAvailable === true
            ? 'available'
            : item.confirmedAvailable === false
              ? 'unavailable'
              : 'unknown';
        const drift = item.confirmedAvailable !== null && item.confirmedAvailable !== item.desiredAvailable;
        return (
          <li key={`${item.providerItemId}:${item.productId}:${item.variationId ?? ''}`}>
            <div>
              <strong>
                <code dir="ltr">{item.providerItemId}</code>
              </strong>
              <span>
                {t(`deliveryChannels.availability.item.${state}`, {
                  defaultValue: t('deliveryChannels.availability.item.unknown'),
                })}
              </span>
            </div>
            {drift && <StatusBadge tone="warning">{t('deliveryChannels.availability.drift')}</StatusBadge>}
            {(item.isStale || stale) && <StatusBadge tone="warning">{t('deliveryChannels.stale')}</StatusBadge>}
            {item.reasonCode && (
              <p>
                {t(`deliveryChannels.codes.${item.reasonCode}`, { defaultValue: t('deliveryChannels.codes.generic') })}
              </p>
            )}
            <small>
              {t('deliveryChannels.availability.itemChecked', {
                time: formatDeliveryChannelDate(item.verifiedAt, locale, t('deliveryChannels.timeUnavailable')),
              })}
            </small>
          </li>
        );
      })}
    </ul>
  );
}
