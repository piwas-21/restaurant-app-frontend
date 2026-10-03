'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { DeliveryChannelPreview, DeliveryChannelPublication } from '@/types/deliveryChannelCatalogue';
import detailsStyles from './DeliveryChannelTechnicalDetails.module.css';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelPublishConfirmationModal.module.css';

interface Props {
  readonly isOpen: boolean;
  readonly canPublish: boolean;
  readonly busy: string | null;
  readonly preview: DeliveryChannelPreview | null;
  readonly storeName: string;
  readonly storeId: string;
  readonly onClose: () => void;
  readonly onPublish: (confirmedTaxProfile: boolean) => Promise<DeliveryChannelPublication | null>;
}

export default function DeliveryChannelPublishConfirmationModal({
  isOpen,
  canPublish,
  busy,
  preview,
  storeName,
  storeId,
  onClose,
  onPublish,
}: Readonly<Props>) {
  const { t, i18n } = useTranslation();
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [taxProfileConfirmed, setTaxProfileConfirmed] = useState(false);
  const isPublishing = busy === 'publish';
  const requiresTaxProfile = preview?.selectionMode === 'categoryItemsV1';
  const taxProfileRevision = preview?.taxProfileRevision;
  const canConfirmTaxProfile = Boolean(
    taxProfileRevision && preview?.taxProfile?.profileRevision === taxProfileRevision,
  );
  const taxRate = preview?.taxProfile
    ? new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, { maximumFractionDigits: 2 }).format(
        preview.taxProfile.vatRatePercentage,
      )
    : null;

  useEffect(() => {
    setReplaceConfirmed(false);
    setTaxProfileConfirmed(false);
  }, [isOpen, preview?.publicationRevision, preview?.taxProfileRevision, storeId]);

  const close = () => {
    setReplaceConfirmed(false);
    onClose();
  };

  const confirmPublish = async () => {
    if (
      !replaceConfirmed ||
      (requiresTaxProfile && (!taxProfileConfirmed || !canConfirmTaxProfile)) ||
      !canPublish ||
      !preview ||
      isPublishing
    )
      return;
    await onPublish(requiresTaxProfile && taxProfileConfirmed);
    close();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      title={t('deliveryChannels.publication.confirmTitle')}
      size="lg"
      presentation="responsive-sheet"
      isPending={isPublishing}
      footer={
        <div className={styles.actions}>
          <button className={workspaceStyles.secondaryAction} type="button" onClick={close} disabled={isPublishing}>
            {t('deliveryChannels.cancel')}
          </button>
          <button
            className={workspaceStyles.action}
            type="button"
            onClick={() => void confirmPublish()}
            disabled={
              !canPublish ||
              !preview ||
              !replaceConfirmed ||
              (requiresTaxProfile && (!taxProfileConfirmed || !canConfirmTaxProfile)) ||
              isPublishing
            }
          >
            {isPublishing ? t('deliveryChannels.loading') : t('deliveryChannels.publication.confirmPublish')}
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <p>
          {t('deliveryChannels.publication.confirmSummary', {
            store: storeName,
            count: preview?.selectedItems?.length ?? preview?.items.length ?? 0,
          })}
        </p>
        <p>{t('deliveryChannels.publication.fullReplacement')}</p>
        <p>{t('deliveryChannels.publication.noBlindRetry')}</p>
        {requiresTaxProfile && preview?.taxProfile && taxRate && (
          <section className={styles.taxProfile} aria-labelledby="delivery-channel-confirm-tax-title">
            <h3 id="delivery-channel-confirm-tax-title">{t('deliveryChannels.publication.reviewedTaxTitle')}</h3>
            <p>{t('deliveryChannels.publication.reviewedTaxRate', { rate: taxRate })}</p>
            <p>{t('deliveryChannels.publication.reviewedTaxBody')}</p>
            {preview.taxProfile.merchantVerificationRequired && (
              <p>{t('deliveryChannels.publication.merchantTaxVerificationNote')}</p>
            )}
            <CheckboxField
              label={t('deliveryChannels.publication.confirmTaxProfile')}
              checked={taxProfileConfirmed}
              onChange={setTaxProfileConfirmed}
              disabled={isPublishing || !canConfirmTaxProfile}
              data-testid="delivery-channel-confirm-tax-profile"
            />
          </section>
        )}
        <details className={detailsStyles.details}>
          <summary>{t('deliveryChannels.publication.technicalDetails')}</summary>
          <dl>
            <div>
              <dt>{t('deliveryChannels.publication.mappingRevision')}</dt>
              <dd>
                <code>{preview?.mappingRevision ?? ''}</code>
              </dd>
            </div>
            <div>
              <dt>{t('deliveryChannels.publication.sourceRevision')}</dt>
              <dd>
                <code>{preview?.sourceRevision ?? ''}</code>
              </dd>
            </div>
            <div>
              <dt>{t('deliveryChannels.publication.publicationRevision')}</dt>
              <dd>
                <code>{preview?.publicationRevision ?? ''}</code>
              </dd>
            </div>
            {preview?.taxProfile && (
              <div>
                <dt>{t('deliveryChannels.publication.reviewedTaxTitle')}</dt>
                <dd>
                  <code>{preview.taxProfileRevision ?? ''}</code>
                </dd>
              </div>
            )}
            <div>
              <dt>{t('deliveryChannels.store.idLabel')}</dt>
              <dd>
                <code dir="ltr">{storeId}</code>
              </dd>
            </div>
          </dl>
        </details>
        <CheckboxField
          label={t('deliveryChannels.publication.confirmFullReplacement')}
          checked={replaceConfirmed}
          onChange={setReplaceConfirmed}
          disabled={isPublishing}
        />
      </div>
    </BaseModal>
  );
}
