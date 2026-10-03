'use client';

import { useTranslation } from 'react-i18next';
import type { DeliveryChannelPreview } from '@/types/deliveryChannelCatalogue';
import { formatDeliveryChannelPrice } from '@/lib/deliveryChannelFormat';
import DeliveryChannelServiceHoursReview from './DeliveryChannelServiceHoursReview';
import DeliveryChannelCategoryPreflightReview from './DeliveryChannelCategoryPreflightReview';
import detailsStyles from './DeliveryChannelTechnicalDetails.module.css';
import styles from './DeliveryChannelPublicationPanel.module.css';

interface Props {
  readonly preview: DeliveryChannelPreview;
  readonly locale: string;
}

export default function DeliveryChannelPreflightReview({ preview, locale }: Readonly<Props>) {
  const { t } = useTranslation();

  if (preview.selectionMode === 'categoryItemsV1') {
    return <DeliveryChannelCategoryPreflightReview preview={preview} locale={locale} />;
  }

  return (
    <>
      <div className={preview.canPublish ? styles.confirmed : styles.blocked}>
        <strong>
          {t(
            preview.canPublish
              ? 'deliveryChannels.publication.preflightReady'
              : 'deliveryChannels.publication.preflightBlocked',
          )}
        </strong>
        <p>{t('deliveryChannels.publication.reviewFreshness')}</p>
      </div>
      {preview.blockingCodes.length > 0 && (
        <div className={styles.blockerList}>
          <h3>{t('deliveryChannels.publication.blockers')}</h3>
          <ul>
            {preview.blockingCodes.map((code) => (
              <li key={code}>
                {t(`deliveryChannels.codes.${code}`, { defaultValue: t('deliveryChannels.codes.generic') })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview.warningCodes.length > 0 && (
        <div className={styles.warningList}>
          <h3>{t('deliveryChannels.publication.warnings')}</h3>
          <ul>
            {preview.warningCodes.map((code) => (
              <li key={code}>
                {t(`deliveryChannels.codes.${code}`, { defaultValue: t('deliveryChannels.codes.generic') })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table>
          <caption>{t('deliveryChannels.publication.diffCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('deliveryChannels.publication.item')}</th>
              <th scope="col">{t('deliveryChannels.publication.tenantPrice')}</th>
              <th scope="col">{t('deliveryChannels.publication.providerPrice')}</th>
              <th scope="col">{t('deliveryChannels.publication.state')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={item.providerItemId}>
                <th scope="row">
                  <strong>{item.providerItemName}</strong>
                  <span>
                    {[item.productName, item.variationName].filter(Boolean).join(' · ') ||
                      t('deliveryChannels.menu.unmapped')}
                  </span>
                </th>
                <td>
                  {formatDeliveryChannelPrice(
                    item.tenantPriceMinor,
                    item.currency,
                    locale,
                    t('deliveryChannels.priceUnavailable'),
                  )}
                </td>
                <td>
                  {item.providerPriceStatus === 'unknown'
                    ? t('deliveryChannels.menu.providerPriceUnknown')
                    : formatDeliveryChannelPrice(
                        item.providerPriceMinor,
                        item.currency,
                        locale,
                        t('deliveryChannels.priceUnavailable'),
                      )}
                  <small>{t(`deliveryChannels.menu.provenance.${item.providerPriceStatus}`)}</small>
                </td>
                <td>
                  {t(`deliveryChannels.menu.mapping.${item.mappingStatus}`, {
                    defaultValue: t('deliveryChannels.menu.mapping.unmapped'),
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DeliveryChannelServiceHoursReview
        kind="planned"
        days={preview.serviceAvailability}
        status={preview.serviceHoursStatus}
        editable={preview.serviceHoursEditable}
      />
      <DeliveryChannelServiceHoursReview
        kind="provider"
        days={preview.currentServiceAvailability}
        status={preview.currentServiceHoursStatus}
      />
      <details className={detailsStyles.details}>
        <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
        <dl>
          <div>
            <dt>{t('deliveryChannels.publication.mappingRevision')}</dt>
            <dd>
              <code>{preview.mappingRevision}</code>
            </dd>
          </div>
          <div>
            <dt>{t('deliveryChannels.publication.sourceRevision')}</dt>
            <dd>
              <code>{preview.sourceRevision}</code>
            </dd>
          </div>
          <div>
            <dt>{t('deliveryChannels.publication.publicationRevision')}</dt>
            <dd>
              <code>{preview.publicationRevision}</code>
            </dd>
          </div>
        </dl>
        <ul className={detailsStyles.items}>
          {preview.items.map((item) => (
            <li key={item.providerItemId}>
              <span>
                {item.providerItemName} · {t('deliveryChannels.publication.providerItemId')}:{' '}
              </span>
              <code>{item.providerItemId}</code>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
