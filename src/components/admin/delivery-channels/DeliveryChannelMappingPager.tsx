'use client';

import { useTranslation } from 'react-i18next';
import type { DeliveryChannelMappingView } from '@/utils/deliveryChannelMappingView';
import styles from './DeliveryChannelCataloguePanel.module.css';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';

interface Props {
  readonly view: DeliveryChannelMappingView;
  readonly onChange: (page: number) => void;
}
export default function DeliveryChannelMappingPager({ view, onChange }: Readonly<Props>) {
  const { t } = useTranslation();
  return (
    <div className={styles.mappingPager}>
      <p aria-live="polite" aria-atomic="true">
        {t('deliveryChannels.menu.mappingRange', { start: view.start, end: view.end, total: view.total })}
      </p>
      <fieldset aria-label={t('deliveryChannels.menu.mappingPaginationLabel')}>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => onChange(Math.max(0, view.page - 1))}
          disabled={view.page === 0}
        >
          {t('deliveryChannels.menu.mappingPreviousPage')}
        </button>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => onChange(view.page + 1)}
          disabled={view.page >= view.pageCount - 1}
        >
          {t('deliveryChannels.menu.mappingNextPage')}
        </button>
      </fieldset>
    </div>
  );
}
