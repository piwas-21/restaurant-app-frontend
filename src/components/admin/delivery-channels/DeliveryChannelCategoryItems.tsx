'use client';

import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { formatDeliveryChannelPrice } from '@/lib/deliveryChannelFormat';
import type { DeliveryChannelCategoryCandidate } from '@/types/deliveryChannelMenuSelection';
import { categoryItemIsSelected, type DeliveryChannelCategoryOverrideMap } from '@/utils/deliveryChannelMenuSelection';
import styles from './DeliveryChannelCategorySelectionPanel.module.css';

interface Props {
  readonly items: readonly DeliveryChannelCategoryCandidate[];
  readonly selectedCategoryIds: ReadonlySet<string>;
  readonly overrides: DeliveryChannelCategoryOverrideMap;
  readonly currency: string;
  readonly locale: string;
  readonly disabled: boolean;
  readonly onToggle: (item: DeliveryChannelCategoryCandidate, selected: boolean) => void;
}

export default function DeliveryChannelCategoryItems({
  items,
  selectedCategoryIds,
  overrides,
  currency,
  locale,
  disabled,
  onToggle,
}: Readonly<Props>) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className={styles.empty}>{t('deliveryChannels.menuSelection.noItems')}</p>;

  return (
    <ul className={styles.itemList} aria-label={t('deliveryChannels.menuSelection.item')}>
      {items.map((item) => {
        const variationSuffix = ` — ${item.variationName}`;
        const label =
          item.variationName && !item.name.endsWith(variationSuffix) ? `${item.name}${variationSuffix}` : item.name;
        const selected = categoryItemIsSelected(item, selectedCategoryIds, overrides);
        const reason = item.blockReason
          ? t(`deliveryChannels.codes.${item.blockReason}`, { defaultValue: t('deliveryChannels.codes.generic') })
          : null;
        return (
          <li key={item.selectionKey}>
            <CheckboxField
              label={label}
              checked={selected}
              disabled={disabled || !item.categoryId}
              onChange={(value) => onToggle(item, value)}
              data-testid={`delivery-channel-menu-item-${item.selectionKey}`}
            />
            <div className={styles.itemMeta}>
              {item.priceMinor === null ? (
                <span>{t('deliveryChannels.priceUnavailable')}</span>
              ) : (
                <span>
                  {formatDeliveryChannelPrice(
                    item.priceMinor,
                    currency,
                    locale,
                    t('deliveryChannels.priceUnavailable'),
                  )}
                </span>
              )}
              {!item.supported && (
                <StatusBadge tone="warning">{reason ?? t('deliveryChannels.codes.generic')}</StatusBadge>
              )}
              {!item.available && (
                <StatusBadge tone="neutral">{t('deliveryChannels.codes.UnavailableProduct')}</StatusBadge>
              )}
            </div>
            <details className={styles.technicalDetails}>
              <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
              <code dir="ltr">{item.selectionKey}</code>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
