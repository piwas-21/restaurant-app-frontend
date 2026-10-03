'use client';

import { useTranslation } from 'react-i18next';
import type { DeliveryChannelWorkspaceSectionId } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import type { useDeliveryChannelCatalogue } from '@/hooks/admin/useDeliveryChannelCatalogue';
import type { useDeliveryChannelCategorySelection } from '@/hooks/admin/useDeliveryChannelCategorySelection';
import type { useDeliveryChannelOperations } from '@/hooks/admin/useDeliveryChannelOperations';
import type { useDeliveryChannelOverview } from '@/hooks/admin/useDeliveryChannelOverview';
import type { useDeliveryChannelPublication } from '@/hooks/admin/useDeliveryChannelPublication';
import DeliveryChannelManagementSections from './DeliveryChannelManagementSections';
import DeliveryChannelWorkspaceNavigation from './DeliveryChannelWorkspaceNavigation';
import styles from './DeliveryChannelManagement.module.css';
import stateStyles from './DeliveryChannelManagementState.module.css';
import workspaceStyles from './DeliveryChannelManagementWorkspace.module.css';

interface Props {
  readonly summary: DeliveryChannelManagementSummary;
  readonly locale: string;
  readonly connected: boolean;
  readonly overview: ReturnType<typeof useDeliveryChannelOverview>;
  readonly catalogue: ReturnType<typeof useDeliveryChannelCatalogue>;
  readonly categorySelection: ReturnType<typeof useDeliveryChannelCategorySelection>;
  readonly publication: ReturnType<typeof useDeliveryChannelPublication>;
  readonly operations: ReturnType<typeof useDeliveryChannelOperations>;
  readonly activeSection: DeliveryChannelWorkspaceSectionId;
  readonly onSectionChange: (section: DeliveryChannelWorkspaceSectionId) => void;
  readonly onRefreshAll: () => Promise<void>;
  readonly onConnectionRefresh: () => Promise<boolean>;
  readonly onPreview: () => Promise<boolean>;
}

export default function DeliveryChannelManagementWorkspace({
  summary,
  locale,
  connected,
  overview,
  catalogue,
  categorySelection,
  publication,
  operations,
  activeSection,
  onSectionChange,
  onRefreshAll,
  onConnectionRefresh,
  onPreview,
}: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('deliveryChannels.eyebrow')}</p>
          <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
          <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={() => void onRefreshAll()}
          disabled={overview.refreshing || catalogue.busy !== null}
        >
          {overview.refreshing ? t('deliveryChannels.loading') : t('deliveryChannels.refresh')}
        </button>
      </header>

      {operations.statusCheckRequired && activeSection !== 'availability' && (
        <div className={workspaceStyles.statusRecovery} role="alert">
          <p>{t('deliveryChannels.operations.statusCheckRequired')}</p>
          <button type="button" onClick={() => void operations.readStatus()} disabled={operations.busy !== null}>
            {operations.busy === 'availability' ? t('deliveryChannels.loading') : t('deliveryChannels.refreshStatus')}
          </button>
        </div>
      )}
      {overview.isStale && <output className={stateStyles.staleNotice}>{t('deliveryChannels.stale')}</output>}
      {overview.failure === 'unavailable' && (
        <p className={stateStyles.staleNotice} role="alert">
          {t('deliveryChannels.unavailable.staleData')}
        </p>
      )}

      <div className={workspaceStyles.workspaceLayout}>
        <div className={workspaceStyles.navigationColumn}>
          <DeliveryChannelWorkspaceNavigation activeSection={activeSection} onChange={onSectionChange} />
        </div>
        <div className={workspaceStyles.workspaceContent}>
          <DeliveryChannelManagementSections
            activeSection={activeSection}
            summary={summary}
            locale={locale}
            connected={connected}
            overview={overview}
            catalogue={catalogue}
            categorySelection={categorySelection}
            publication={publication}
            operations={operations}
            onSectionChange={onSectionChange}
            onConnectionRefresh={onConnectionRefresh}
            onPreview={onPreview}
          />
        </div>
      </div>
    </div>
  );
}
