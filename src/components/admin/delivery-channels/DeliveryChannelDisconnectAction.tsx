'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelConnectionPanel.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly busy: string | null;
  readonly canWrite: boolean;
  readonly feedback: DeliveryChannelOperationFeedback | null;
  readonly onDisconnect: (storeId: string) => Promise<void>;
}

export default function DeliveryChannelDisconnectAction({
  summary,
  busy,
  canWrite,
  feedback,
  onDisconnect,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const confirmedStore = summary.storeConfirmed && Boolean(summary.storeId);

  const disconnect = async () => {
    if (!confirmedStore || !canWrite) return;
    await onDisconnect(summary.storeId);
    setOpen(false);
  };

  if (!confirmedStore) return null;

  return (
    <div className={styles.disconnectArea}>
      <p>{t('deliveryChannels.connection.disconnectDescription')}</p>
      <button
        className={workspaceStyles.secondaryAction}
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canWrite || busy !== null}
      >
        {t('deliveryChannels.connection.disconnect')}
      </button>
      {feedback?.kind === 'disconnect' && (
        <p className={feedback.outcome === 'confirmed' ? styles.success : styles.error} role="status">
          {t(`deliveryChannels.operations.${feedback.outcome}`)}
        </p>
      )}
      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('deliveryChannels.connection.disconnectConfirmTitle')}
        presentation="responsive-sheet"
        isPending={busy === 'disconnect'}
        footer={
          <div className={styles.modalActions}>
            <button
              type="button"
              className={workspaceStyles.secondaryAction}
              onClick={() => setOpen(false)}
              disabled={busy === 'disconnect'}
            >
              {t('deliveryChannels.cancel')}
            </button>
            <button
              type="button"
              className={styles.dangerAction}
              onClick={() => void disconnect()}
              disabled={!canWrite || busy === 'disconnect'}
            >
              {busy === 'disconnect' ? t('deliveryChannels.loading') : t('deliveryChannels.connection.disconnect')}
            </button>
          </div>
        }
      >
        <div className={styles.modalBody}>
          <p>
            {t('deliveryChannels.connection.disconnectConfirmBody', {
              store: summary.storeDisplayName || summary.storeId,
            })}
          </p>
          <p>
            {t('deliveryChannels.store.idLabel')}: <code dir="ltr">{summary.storeId}</code>
          </p>
          <ul>
            <li>{t('deliveryChannels.connection.disconnectPauses')}</li>
            <li>{t('deliveryChannels.connection.disconnectRelinquishes')}</li>
            <li>{t('deliveryChannels.connection.disconnectHistory')}</li>
          </ul>
        </div>
      </BaseModal>
    </div>
  );
}
