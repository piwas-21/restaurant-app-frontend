'use client';

import { useTranslation } from 'react-i18next';
import { formatDeliveryChannelPrice } from '@/lib/deliveryChannelFormat';
import type { DeliveryChannelPreview } from '@/types/deliveryChannelCatalogue';
import detailsStyles from './DeliveryChannelTechnicalDetails.module.css';
import styles from './DeliveryChannelPublicationPanel.module.css';

function previewItemStatus(
  item: NonNullable<DeliveryChannelPreview['selectedItems']>[number],
  translate: ReturnType<typeof useTranslation>['t'],
): string {
  if (!item.supported) {
    return translate(`deliveryChannels.codes.${item.blockReason ?? 'UnmappedProduct'}`, {
      defaultValue: translate('deliveryChannels.codes.generic'),
    });
  }
  if (item.available) return translate('deliveryChannels.availability.item.available');
  return translate('deliveryChannels.availability.item.unavailable');
}

interface Props {
  readonly preview: DeliveryChannelPreview;
  readonly locale: string;
}

export default function DeliveryChannelCategoryPreflightReview({ preview, locale }: Readonly<Props>) {
  const { t } = useTranslation();
  const items = preview.selectedItems ?? [];
  const taxRate = preview.taxProfile
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(preview.taxProfile.vatRatePercentage)
    : null;

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
      {preview.taxProfile && taxRate && (
        <section className={styles.confirmed} aria-labelledby="delivery-channel-tax-profile-title">
          <h3 id="delivery-channel-tax-profile-title">{t('deliveryChannels.publication.reviewedTaxTitle')}</h3>
          <p>{t('deliveryChannels.publication.reviewedTaxRate', { rate: taxRate })}</p>
          <p>{t('deliveryChannels.publication.reviewedTaxBody')}</p>
          {preview.taxProfile.merchantVerificationRequired && (
            <p>{t('deliveryChannels.publication.merchantTaxVerificationNote')}</p>
          )}
        </section>
      )}
      <div className={styles.tableWrap}>
        <table>
          <caption>{t('deliveryChannels.publication.diffCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('deliveryChannels.publication.item')}</th>
              <th scope="col">{t('deliveryChannels.publication.tenantPrice')}</th>
              <th scope="col">{t('deliveryChannels.publication.state')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.selectionKey}>
                <th scope="row">
                  <strong>{item.name}</strong>
                  <span>{item.categoryName}</span>
                </th>
                <td>
                  {formatDeliveryChannelPrice(
                    item.priceMinor,
                    preview.currency,
                    locale,
                    t('deliveryChannels.priceUnavailable'),
                  )}
                </td>
                <td>{previewItemStatus(item, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className={detailsStyles.details}>
        <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
        <dl>
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
          {preview.taxProfile && (
            <div>
              <dt>{t('deliveryChannels.publication.reviewedTaxTitle')}</dt>
              <dd>
                <code>{preview.taxProfileRevision ?? ''}</code>
              </dd>
            </div>
          )}
        </dl>
        <ul className={detailsStyles.items}>
          {items.map((item) => (
            <li key={item.selectionKey}>
              <span>
                {item.name} · {t('deliveryChannels.publication.providerItemId')}:{' '}
              </span>
              <code>{item.providerItemId}</code>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
