'use client';

import { useTranslation } from 'react-i18next';
import DeliveryChannelManagementWorkspace from './DeliveryChannelManagementWorkspace';
import { useDeliveryChannelCatalogue } from '@/hooks/admin/useDeliveryChannelCatalogue';
import { useDeliveryChannelOperations } from '@/hooks/admin/useDeliveryChannelOperations';
import { useDeliveryChannelOverview } from '@/hooks/admin/useDeliveryChannelOverview';
import { useDeliveryChannelPublication } from '@/hooks/admin/useDeliveryChannelPublication';
import { useDeliveryChannelWorkspaceSection } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import styles from './DeliveryChannelManagement.module.css';
import stateStyles from './DeliveryChannelManagementState.module.css';

export default function DeliveryChannelManagement() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const overview = useDeliveryChannelOverview();
  const catalogue = useDeliveryChannelCatalogue(Boolean(overview.summary?.enabled));
  const publication = useDeliveryChannelPublication({
    catalogue: catalogue.catalogue,
    selectionVersion: catalogue.selectionVersion,
    dirty: catalogue.dirty,
    stale: catalogue.stale,
    draftWriteUncertain: catalogue.writeUncertain,
    refreshCatalogue: catalogue.refresh,
  });
  const operations = useDeliveryChannelOperations(overview.refresh);
  const summary = overview.summary;
  const connected = Boolean(summary?.enabled && summary.connectionStatus === 'connected' && summary.storeConfirmed);
  const { activeSection, setActiveSection } = useDeliveryChannelWorkspaceSection();

  const refreshConnection = async () => {
    const result = await overview.refresh(true);
    return result.summary && result.fresh;
  };

  const refreshAll = async () => {
    if (operations.statusCheckRequired) {
      await operations.readStatus();
    } else {
      await overview.refresh();
    }
    await catalogue.refresh();
  };

  const preparePreview = async () => {
    const preview = await publication.createPreview();
    if (preview) setActiveSection('publish');
    return Boolean(preview);
  };

  if (overview.loading && !summary) {
    return (
      <div className={styles.page} aria-busy="true">
        <p>
          <output>{t('deliveryChannels.loading')}</output>
        </p>
      </div>
    );
  }

  if (overview.failure === 'moduleDisabled' || summary?.enabled === false) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
            <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
          </div>
        </header>
        <section className={stateStyles.blocked}>
          <h2>{t('deliveryChannels.moduleDisabled.setupTitle')}</h2>
          <p>{t('deliveryChannels.moduleDisabled.setupBody')}</p>
          <ol>
            <li>{t('deliveryChannels.moduleDisabled.setupStepOne')}</li>
            <li>{t('deliveryChannels.moduleDisabled.setupStepTwo')}</li>
            <li>{t('deliveryChannels.moduleDisabled.setupStepThree')}</li>
            <li>{t('deliveryChannels.moduleDisabled.setupStepFour')}</li>
          </ol>
          <p className={stateStyles.productionNote}>{t('deliveryChannels.moduleDisabled.productionNote')}</p>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void overview.refresh(true)}
            disabled={overview.refreshing}
          >
            {overview.refreshing ? t('deliveryChannels.loading') : t('deliveryChannels.refresh')}
          </button>
        </section>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
            <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
          </div>
        </header>
        <section className={stateStyles.blocked} role="alert">
          <h2>{t('deliveryChannels.unavailable.title')}</h2>
          <p>{t('deliveryChannels.unavailable.body')}</p>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void refreshAll()}
            disabled={overview.refreshing}
          >
            {t('deliveryChannels.refresh')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <DeliveryChannelManagementWorkspace
      summary={summary}
      locale={locale}
      connected={connected}
      overview={overview}
      catalogue={catalogue}
      publication={publication}
      operations={operations}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onRefreshAll={refreshAll}
      onConnectionRefresh={refreshConnection}
      onPreview={preparePreview}
    />
  );
}
