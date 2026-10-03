'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelItemAvailability } from '@/types/deliveryChannelManagement';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import { availabilityIdentity } from '@/utils/deliveryChannelAvailabilityLabels';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly items: readonly DeliveryChannelItemAvailability[];
  readonly itemLabels?: ReadonlyMap<string, string>;
  readonly locale: string;
  readonly stale: boolean;
}

export default function DeliveryChannelAvailabilityItems({ items, itemLabels, locale, stale }: Readonly<Props>) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <ul className={styles.items}>
      {items.map((item) => {
        let state: 'available' | 'unavailable' | 'unknown' = 'unknown';
        if (item.confirmedAvailable === true) state = 'available';
        if (item.confirmedAvailable === false) state = 'unavailable';
        const drift = item.confirmedAvailable !== null && item.confirmedAvailable !== item.desiredAvailable;
        const identity = availabilityIdentity(item.productId, item.variationId);
        const label = itemLabels?.get(identity);
        return (
          <li key={`${item.providerItemId}:${item.productId}:${item.variationId ?? ''}`}>
            <div>
              <strong>{label ?? t('deliveryChannels.publication.item')}</strong>
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
            {!label && (
              <p className={styles.identityFallback}>
                <code dir="ltr">
                  {item.productId}
                  {item.variationId ? ` · ${item.variationId}` : ''}
                </code>
              </p>
            )}
            <details className={styles.itemDetails}>
              <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
              <span>{t('deliveryChannels.publication.providerItemId')}</span>
              <code dir="ltr">{item.providerItemId}</code>
            </details>
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
