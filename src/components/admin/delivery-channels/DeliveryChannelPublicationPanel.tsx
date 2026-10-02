'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelPreview, DeliveryChannelPublication } from '@/types/deliveryChannelCatalogue';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import DeliveryChannelPreflightReview from './DeliveryChannelPreflightReview';
import DeliveryChannelPublishConfirmationModal from './DeliveryChannelPublishConfirmationModal';
import detailsStyles from './DeliveryChannelTechnicalDetails.module.css';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelPublicationPanel.module.css';

interface Props {
  readonly preview: DeliveryChannelPreview | null;
  readonly publication: DeliveryChannelPublication | null;
  readonly busy: string | null;
  readonly error: string | null;
  readonly requestError?: string | null;
  readonly canPublish: boolean;
  readonly unresolvedPublication: boolean;
  readonly writeUncertain: boolean;
  readonly storeName: string | null;
  readonly storeId: string;
  readonly incomingOrdersEnabled: boolean;
  readonly locale: string;
  readonly onPublish: () => Promise<DeliveryChannelPublication | null>;
  readonly onCheckPublication: () => Promise<DeliveryChannelPublication | null>;
}

function resultTone(publication: DeliveryChannelPublication | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (publication?.state === 'verified' && publication.providerReadbackVerified) return 'success';
  if (publication?.state === 'failed' || publication?.state === 'mismatch') return 'danger';
  if (publication?.state === 'uncertain' || publication?.state === 'pending') return 'warning';
  return 'neutral';
}

export default function DeliveryChannelPublicationPanel({
  preview,
  publication,
  busy,
  error,
  requestError,
  canPublish,
  unresolvedPublication,
  writeUncertain,
  storeName,
  storeId,
  incomingOrdersEnabled,
  locale,
  onPublish,
  onCheckPublication,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isVerified = publication?.state === 'verified' && publication.providerReadbackVerified;
  const displayStoreName = storeName?.trim() || t('deliveryChannels.store.nameUnavailable');
  const statusKey = publication
    ? `deliveryChannels.publication.status.${publication.state}`
    : 'deliveryChannels.publication.notPublished';

  return (
    <section className={workspaceStyles.panel} aria-labelledby="delivery-channel-publication-title">
      <div className={styles.heading}>
        <div>
          <h2 id="delivery-channel-publication-title" className={styles.title}>
            {t('deliveryChannels.publication.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.publication.description')}</p>
        </div>
        <StatusBadge tone={resultTone(publication)}>{t(statusKey)}</StatusBadge>
      </div>

      {error && (
        <p className={styles.warning} role="alert">
          {requestError ??
            t(`deliveryChannels.errors.${error}`, { defaultValue: t('deliveryChannels.errors.generic') })}
        </p>
      )}
      {writeUncertain && (
        <p className={styles.warning} role="alert">
          {t('deliveryChannels.publication.uncertainNoResend')}
        </p>
      )}
      {unresolvedPublication && (
        <div className={styles.notice}>
          <p>
            <output>{t('deliveryChannels.publication.unresolved')}</output>
          </p>
          <button
            className={workspaceStyles.textAction}
            type="button"
            onClick={() => void onCheckPublication()}
            disabled={busy !== null}
          >
            {busy === 'check' ? t('deliveryChannels.loading') : t('deliveryChannels.publication.checkStatus')}
          </button>
        </div>
      )}
      {publication && (
        <div className={isVerified ? styles.confirmed : styles.result}>
          <strong>{t('deliveryChannels.publication.providerResult')}</strong>
          <p>
            {t(
              isVerified
                ? 'deliveryChannels.publication.readbackVerified'
                : 'deliveryChannels.publication.readbackNotVerified',
            )}
          </p>
          {publication.verifiedAt && (
            <p>
              {t('deliveryChannels.publication.verifiedAt', {
                time: formatDeliveryChannelDate(publication.verifiedAt, locale, t('deliveryChannels.timeUnavailable')),
              })}
            </p>
          )}
          {publication.resultCode && (
            <p>
              {t(`deliveryChannels.codes.${publication.resultCode}`, {
                defaultValue: t('deliveryChannels.codes.generic'),
              })}
            </p>
          )}
          <details className={detailsStyles.details}>
            <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
            <dl>
              <div>
                <dt>{t('deliveryChannels.publication.mappingRevision')}</dt>
                <dd>
                  <code>{publication.mappingRevision}</code>
                </dd>
              </div>
              <div>
                <dt>{t('deliveryChannels.publication.sourceRevision')}</dt>
                <dd>
                  <code>{publication.sourceRevision}</code>
                </dd>
              </div>
              <div>
                <dt>{t('deliveryChannels.publication.publicationRevision')}</dt>
                <dd>
                  <code>{publication.publicationRevision}</code>
                </dd>
              </div>
              <div>
                <dt>{t('deliveryChannels.publication.operationId')}</dt>
                <dd>
                  <code>{publication.id}</code>
                </dd>
              </div>
            </dl>
          </details>
        </div>
      )}
      {isVerified && !incomingOrdersEnabled && (
        <p className={styles.notice}>
          <output>{t('deliveryChannels.publication.orderAcceptanceNextStep')}</output>
        </p>
      )}
      {!preview ? (
        <p className={styles.empty}>{t('deliveryChannels.publication.noPreview')}</p>
      ) : (
        <>
          <DeliveryChannelPreflightReview preview={preview} locale={locale} />
          <button
            className={workspaceStyles.action}
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canPublish || busy !== null}
          >
            {t('deliveryChannels.publication.publishFullMenu')}
          </button>
        </>
      )}

      <DeliveryChannelPublishConfirmationModal
        isOpen={confirmOpen}
        canPublish={canPublish}
        busy={busy}
        preview={preview}
        storeName={displayStoreName}
        storeId={storeId}
        onClose={() => setConfirmOpen(false)}
        onPublish={onPublish}
      />
    </section>
  );
}
