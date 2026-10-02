'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './DeliveryChannelAvailabilityPanel.module.css';

interface Props {
  readonly action: 'pause' | 'resume' | null;
  readonly busy: string | null;
  readonly connected: boolean;
  readonly canWrite: boolean;
  readonly duration: string;
  readonly onClose: () => void;
  readonly onConfirm: () => Promise<void>;
}

export default function DeliveryChannelAvailabilityConfirmationModal({
  action,
  busy,
  connected,
  canWrite,
  duration,
  onClose,
  onConfirm,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const isPausing = action === 'pause';
  const isBusy = busy === 'availability';
  const actionLabel = t(isPausing ? 'deliveryChannels.availability.pause' : 'deliveryChannels.availability.resume');
  const confirmButtonLabel = isBusy ? t('deliveryChannels.loading') : actionLabel;

  return (
    <BaseModal
      isOpen={action !== null}
      onClose={onClose}
      title={t(
        isPausing
          ? 'deliveryChannels.availability.pauseConfirmTitle'
          : 'deliveryChannels.availability.resumeConfirmTitle',
      )}
      presentation="responsive-sheet"
      isPending={isBusy}
      footer={
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryAction} onClick={onClose} disabled={isBusy}>
            {t('deliveryChannels.cancel')}
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => void onConfirm()}
            disabled={!connected || !canWrite || isBusy}
          >
            {confirmButtonLabel}
          </button>
        </div>
      }
    >
      <div className={styles.modalBody}>
        <p>{t('deliveryChannels.availability.pauseImpact')}</p>
        <p>{t('deliveryChannels.availability.existingOrdersContinue')}</p>
        {isPausing && <p>{t('deliveryChannels.availability.selectedDuration', { duration })}</p>}
      </div>
    </BaseModal>
  );
}
