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
  readonly onPublish: () => Promise<DeliveryChannelPublication | null>;
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
  const { t } = useTranslation();
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const isPublishing = busy === 'publish';

  useEffect(() => setReplaceConfirmed(false), [isOpen, preview?.publicationRevision]);

  const close = () => {
    setReplaceConfirmed(false);
    onClose();
  };

  const confirmPublish = async () => {
    if (!replaceConfirmed || !canPublish || !preview || isPublishing) return;
    await onPublish();
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
            disabled={!canPublish || !preview || !replaceConfirmed || isPublishing}
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
            count: preview?.items.length ?? 0,
          })}
        </p>
        <p>{t('deliveryChannels.publication.fullReplacement')}</p>
        <p>{t('deliveryChannels.publication.noBlindRetry')}</p>
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
