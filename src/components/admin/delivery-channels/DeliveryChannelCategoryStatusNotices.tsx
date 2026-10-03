'use client';

import { useTranslation } from 'react-i18next';
import styles from './DeliveryChannelCategorySelectionPanel.module.css';

interface Props {
  readonly stale: boolean;
  readonly removedSelectionNotice: boolean;
  readonly showUnsavedNotice: boolean;
  readonly writeUncertain: boolean;
  readonly errorText: string | null;
}

export default function DeliveryChannelCategoryStatusNotices({
  stale,
  removedSelectionNotice,
  showUnsavedNotice,
  writeUncertain,
  errorText,
}: Readonly<Props>) {
  const { t } = useTranslation();
  return (
    <>
      {stale && (
        <p className={styles.warning} role="alert">
          {t('deliveryChannels.menuSelection.sourceChanged')}
        </p>
      )}
      {removedSelectionNotice && (
        <p className={styles.warning} role="alert">
          {t('deliveryChannels.menuSelection.removedSelections')}
        </p>
      )}
      {showUnsavedNotice && (
        <output className={styles.dirtyNotice}>{t('deliveryChannels.menuSelection.needsSaveNotice')}</output>
      )}
      {writeUncertain && (
        <p className={styles.warning} role="alert">
          {t('deliveryChannels.menu.saveUncertain')}
        </p>
      )}
      {errorText && (
        <p className={styles.error} role="alert">
          {errorText}
        </p>
      )}
    </>
  );
}
