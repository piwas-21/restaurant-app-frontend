'use client';

import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { ItemAvailability, MenuDefinition, MenuSection } from '@/types/menu';
import { OrderType } from '@/types/order';
import { formatPlainCurrency } from '@/utils/currency';
import BundlePriceQuotePreview from './BundlePriceQuotePreview';
import styles from './BundleGuestStepPreview.module.css';
import type { BundleSectionAvailability } from '@/utils/bundleChoiceAvailability';

interface BundleGuestStepPreviewProps {
  readonly menuDefinition: MenuDefinition;
  readonly availability?: ItemAvailability;
  readonly sectionAvailability?: readonly BundleSectionAvailability[];
  readonly hideOptionAvailability?: boolean;
  readonly quoteContext?: {
    productId: string;
    isDirty: boolean;
    isActive: boolean;
    isAvailable: boolean;
  };
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.DineIn]: 'order_type_dine_in',
  [OrderType.Takeaway]: 'order_type_takeaway',
  [OrderType.Delivery]: 'order_type_delivery',
};

function channelNames(availability: ItemAvailability, t: TFunction): string {
  return availability.allowedOrderTypes.map((orderType) => t(ORDER_TYPE_LABELS[orderType])).join(', ');
}

function availabilityLabel(availability: ItemAvailability | undefined, t: TFunction): string | undefined {
  if (!availability) return undefined;
  if (availability.reason === 'Unavailable') return t('bundle_preview_unavailable_settings');
  const channels = channelNames(availability, t);
  if (availability.reason === 'WrongOrderType') {
    return channels ? t('bundle_preview_wrong_channel', { channels }) : t('bundle_preview_no_other_channels');
  }
  return channels ? t('bundle_preview_available_channels', { channels }) : undefined;
}

function selectionRule(section: MenuSection, t: TFunction): string {
  if (section.minSelection === section.maxSelection) {
    return t('bundle_preview_choose_exactly', { count: section.minSelection });
  }
  if (section.minSelection === 0) {
    return t('bundle_preview_choose_up_to', { count: section.maxSelection });
  }
  return t('bundle_preview_choose_range', { min: section.minSelection, max: section.maxSelection });
}

/** A small read-only preview of the actual ordered choices a guest will see. */
export default function BundleGuestStepPreview({
  menuDefinition,
  availability,
  sectionAvailability,
  hideOptionAvailability = false,
  quoteContext,
}: BundleGuestStepPreviewProps) {
  const { t } = useTranslation();
  const bundleAvailability = availabilityLabel(availability, t);

  return (
    <section className={styles.preview} aria-labelledby="bundle-guest-preview-heading">
      <div className={styles.header}>
        <div>
          <h3 id="bundle-guest-preview-heading">{t('bundle_guest_preview')}</h3>
          <p>{t('bundle_guest_preview_description')}</p>
        </div>
      </div>
      {bundleAvailability && (
        <StatusBadge tone={availability?.canOrder ? 'success' : 'warning'}>{bundleAvailability}</StatusBadge>
      )}
      {menuDefinition.sections.length === 0 ? (
        <p className={styles.empty}>{t('bundle_guest_preview_empty')}</p>
      ) : (
        <ol className={styles.steps}>
          {[...menuDefinition.sections]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((section) => {
              const availabilitySummary = sectionAvailability?.find((entry) => entry.sectionId === section.id);
              return (
                <li key={section.id || section.name} className={styles.step}>
                  <div className={styles.stepHeader}>
                    <strong>{section.name || t('section')}</strong>
                    <span>{selectionRule(section, t)}</span>
                  </div>
                  {section.description && <p className={styles.description}>{section.description}</p>}
                  {availabilitySummary && (
                    <ul className={styles.channelChoices}>
                      {availabilitySummary.channels.map((channel) => (
                        <li
                          key={channel.orderType}
                          className={channel.meetsMinimum ? undefined : styles.channelWarning}
                        >
                          {availabilitySummary.isRequired
                            ? t('bundle_preview_channel_required_choices', {
                                channel: t(ORDER_TYPE_LABELS[channel.orderType]),
                                available: channel.orderableCount,
                                minimum: channel.minimum,
                              })
                            : t('bundle_preview_channel_orderable_count', {
                                channel: t(ORDER_TYPE_LABELS[channel.orderType]),
                                count: channel.orderableCount,
                              })}
                        </li>
                      ))}
                    </ul>
                  )}
                  <ul className={styles.options}>
                    {[...section.items]
                      .sort((left, right) => left.displayOrder - right.displayOrder)
                      .map((item) => {
                        const freshOption = availabilitySummary?.options.find(
                          (option) =>
                            option.productId === item.productId &&
                            option.productVariationId === (item.productVariationId ?? null),
                        );
                        const freshCanOrder = Boolean(
                          freshOption?.isActive &&
                          freshOption.isAvailable &&
                          freshOption.isActiveVariation &&
                          freshOption.allowedOrderTypes.length > 0,
                        );
                        const itemAvailabilityState: ItemAvailability | undefined = freshOption
                          ? {
                              canOrder: freshCanOrder,
                              reason: freshCanOrder
                                ? 'Available'
                                : freshOption.isActive && freshOption.isAvailable && freshOption.isActiveVariation
                                  ? 'WrongOrderType'
                                  : 'Unavailable',
                              allowedOrderTypes: [...freshOption.allowedOrderTypes],
                            }
                          : item.availability;
                        const itemAvailability = hideOptionAvailability
                          ? undefined
                          : availabilityLabel(itemAvailabilityState, t);
                        return (
                          <li key={item.id || `${item.productId}:${item.productVariationId ?? 'base'}`}>
                            <span>{item.productName || item.productId}</span>
                            <span className={styles.optionMeta}>
                              {item.isDefault && <span>{t('bundle_preview_included_by_default')}</span>}
                              {item.additionalPrice !== 0 && (
                                <span>
                                  {item.additionalPrice > 0 ? '+' : ''}
                                  {formatPlainCurrency(item.additionalPrice)}
                                </span>
                              )}
                              {itemAvailability && (
                                <StatusBadge size="sm" tone={itemAvailabilityState?.canOrder ? 'success' : 'warning'}>
                                  {itemAvailability}
                                </StatusBadge>
                              )}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              );
            })}
        </ol>
      )}
      {quoteContext ? (
        <BundlePriceQuotePreview {...quoteContext} menuDefinition={menuDefinition} availability={availability} />
      ) : (
        <p className={styles.quoteNote}>{t('bundle_preview_quote_note')}</p>
      )}
    </section>
  );
}
