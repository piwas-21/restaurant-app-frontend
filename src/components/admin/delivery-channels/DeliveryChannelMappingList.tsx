'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { candidateIdentity } from '@/hooks/admin/useDeliveryChannelCatalogue';
import type { DeliveryChannelCatalogue, DeliveryChannelCatalogueCandidate } from '@/types/deliveryChannelCatalogue';
import { formatDeliveryChannelPrice } from '@/lib/deliveryChannelFormat';
import styles from './DeliveryChannelCataloguePanel.module.css';

interface Props {
  readonly catalogue: DeliveryChannelCatalogue;
  readonly candidates: readonly DeliveryChannelCatalogueCandidate[];
  readonly selected: Readonly<Record<string, string>>;
  readonly busy: string | null;
  readonly stale: boolean;
  readonly writeUncertain: boolean;
  readonly locale: string;
  readonly onChoose: (providerItemId: string, value: string) => void;
}

function currentItemName(catalogue: DeliveryChannelCatalogue, identity: string): string {
  const item = catalogue.items.find(
    (row) => row.productId && candidateIdentity(row.productId, row.variationId) === identity,
  );
  return item ? [item.productName, item.variationName].filter(Boolean).join(' · ') : identity;
}

export default function DeliveryChannelMappingList({
  catalogue,
  candidates,
  selected,
  busy,
  stale,
  writeUncertain,
  locale,
  onChoose,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const used = new Set(Object.values(selected).filter(Boolean));
  const options = candidates.filter((candidate) => candidate.available && candidate.supported);
  const mappingTone = (status: DeliveryChannelCatalogue['items'][number]['mappingStatus']) => {
    if (status === 'mapped') return 'success';
    if (status === 'blocked') return 'danger';
    return 'warning';
  };

  return (
    <ul className={styles.mappingList}>
      {catalogue.items.map((row) => {
        const current = selected[row.providerItemId] ?? '';
        const blockKey = row.blockReason
          ? `deliveryChannels.codes.${row.blockReason}`
          : 'deliveryChannels.codes.generic';
        const editable = row.mappingStatus !== 'blocked' && !stale && !writeUncertain;
        return (
          <li key={row.providerItemId} className={styles.mappingRow}>
            <div className={styles.providerItem}>
              <div>
                <strong>{row.providerItemName}</strong>
                <code dir="ltr">{row.providerItemId}</code>
              </div>
              <StatusBadge tone={mappingTone(row.mappingStatus)}>
                {t(`deliveryChannels.menu.mapping.${row.mappingStatus}`, {
                  defaultValue: t('deliveryChannels.menu.mapping.unmapped'),
                })}
              </StatusBadge>
              {row.blockReason && (
                <p className={styles.blockReason}>
                  {t(blockKey, { defaultValue: t('deliveryChannels.codes.generic') })}
                </p>
              )}
            </div>
            <FormField label={t('deliveryChannels.menu.mapToTenantItem', { item: row.providerItemName })}>
              <select
                value={current}
                onChange={(event) => onChoose(row.providerItemId, event.target.value)}
                disabled={!editable || busy === 'save'}
              >
                <option value="">{t('deliveryChannels.menu.unmapped')}</option>
                {current &&
                  !options.some(
                    (candidate) => candidateIdentity(candidate.productId, candidate.variationId) === current,
                  ) && <option value={current}>{currentItemName(catalogue, current)}</option>}
                {options.map((candidate) => {
                  const value = candidateIdentity(candidate.productId, candidate.variationId);
                  const alreadyUsed = used.has(value) && current !== value;
                  return (
                    <option key={value} value={value} disabled={alreadyUsed}>
                      {[
                        candidate.name,
                        candidate.variationName,
                        formatDeliveryChannelPrice(
                          candidate.priceMinor,
                          catalogue.currency,
                          locale,
                          t('deliveryChannels.priceUnavailable'),
                        ),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  );
                })}
                {candidates
                  .filter((candidate) => !candidate.available || !candidate.supported)
                  .map((candidate) => (
                    <option
                      key={candidateIdentity(candidate.productId, candidate.variationId)}
                      value={candidateIdentity(candidate.productId, candidate.variationId)}
                      disabled
                    >
                      {[
                        candidate.name,
                        candidate.variationName,
                        t(`deliveryChannels.codes.${candidate.blockReason}`, {
                          defaultValue: t('deliveryChannels.codes.generic'),
                        }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
              </select>
            </FormField>
            <div className={styles.priceReview}>
              <span>
                {t('deliveryChannels.menu.tenantPrice')}:{' '}
                {formatDeliveryChannelPrice(
                  row.tenantPriceMinor,
                  row.currency,
                  locale,
                  t('deliveryChannels.priceUnavailable'),
                )}
              </span>
              <span>
                {t('deliveryChannels.menu.providerPrice')}:{' '}
                {row.providerPriceStatus === 'unknown'
                  ? t('deliveryChannels.menu.providerPriceUnknown')
                  : formatDeliveryChannelPrice(
                      row.providerPriceMinor,
                      row.currency,
                      locale,
                      t('deliveryChannels.priceUnavailable'),
                    )}
                {' · '}
                {t(`deliveryChannels.menu.provenance.${row.providerPriceStatus}`)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
