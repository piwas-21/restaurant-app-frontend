'use client';

import { useTranslation } from 'react-i18next';
import DeliveryChannelAvailabilityPanel from './DeliveryChannelAvailabilityPanel';
import DeliveryChannelCataloguePanel from './DeliveryChannelCataloguePanel';
import DeliveryChannelConnectionPanel from './DeliveryChannelConnectionPanel';
import DeliveryChannelExceptionInbox from './DeliveryChannelExceptionInbox';
import DeliveryChannelPublicationPanel from './DeliveryChannelPublicationPanel';
import DeliveryChannelStepNavigation from './DeliveryChannelStepNavigation';
import { useDeliveryChannelCatalogue } from '@/hooks/admin/useDeliveryChannelCatalogue';
import { useDeliveryChannelOperations } from '@/hooks/admin/useDeliveryChannelOperations';
import { useDeliveryChannelOverview } from '@/hooks/admin/useDeliveryChannelOverview';
import { useDeliveryChannelPublication } from '@/hooks/admin/useDeliveryChannelPublication';
import { useDeliveryChannelStep } from '@/hooks/admin/useDeliveryChannelStep';
import styles from './DeliveryChannelManagement.module.css';

export default function DeliveryChannelManagement() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const overview = useDeliveryChannelOverview();
  const catalogue = useDeliveryChannelCatalogue();
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
  const { activeStep, setActiveStep } = useDeliveryChannelStep(connected);

  const refreshConnection = async () => (await overview.refresh()).summary;

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
    if (preview) setActiveStep('publish');
    return Boolean(preview);
  };

  if (overview.loading && !summary) {
    return (
      <main className={styles.page} aria-busy="true">
        <p role="status">{t('deliveryChannels.loading')}</p>
      </main>
    );
  }

  if (overview.failure === 'moduleDisabled') {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
            <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
          </div>
        </header>
        <section className={styles.blocked} role="status">
          <h2>{t('deliveryChannels.moduleDisabled.title')}</h2>
          <p>{t('deliveryChannels.moduleDisabled.body')}</p>
        </section>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
            <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
          </div>
        </header>
        <section className={styles.blocked} role="alert">
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
      </main>
    );
  }

  const canReviewMenu = connected;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('deliveryChannels.eyebrow')}</p>
          <h1 className={styles.title}>{t('deliveryChannels.title')}</h1>
          <p className={styles.subtitle}>{t('deliveryChannels.subtitle')}</p>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={() => void refreshAll()}
          disabled={overview.refreshing || catalogue.busy !== null}
        >
          {overview.refreshing ? t('deliveryChannels.loading') : t('deliveryChannels.refresh')}
        </button>
      </header>

      {overview.isStale && (
        <div className={styles.staleNotice} role="status">
          <p>{t('deliveryChannels.stale')}</p>
        </div>
      )}
      {overview.failure === 'unavailable' && summary && (
        <p className={styles.staleNotice} role="alert">
          {t('deliveryChannels.unavailable.staleData')}
        </p>
      )}

      {summary.enabled && (
        <DeliveryChannelExceptionInbox
          items={overview.exceptions}
          checkedAt={overview.exceptionsCheckedAt}
          stale={overview.exceptionsStale}
          errorMessage={overview.exceptionErrorMessage}
          hasMore={overview.hasMoreExceptions}
          loadingMore={overview.loadingMoreExceptions}
          busy={operations.busy}
          feedback={operations.feedback}
          locale={locale}
          onReconcile={operations.reconcile}
          onLoadMore={overview.loadMoreExceptions}
        />
      )}

      <DeliveryChannelConnectionPanel
        summary={summary}
        locale={locale}
        busy={operations.busy}
        canWrite={operations.canWrite}
        menuProviderVerified={publication.verified}
        feedback={operations.feedback}
        onDisconnect={operations.disconnect}
        onRefresh={refreshConnection}
      />

      {canReviewMenu && (
        <>
          <DeliveryChannelStepNavigation
            activeStep={activeStep}
            canReviewMenu
            canPublish={Boolean(publication.preview)}
            onChange={setActiveStep}
          />
          {activeStep === 'menu' &&
            (catalogue.catalogue ? (
              <DeliveryChannelCataloguePanel
                catalogue={catalogue.catalogue}
                candidates={catalogue.candidates}
                selected={catalogue.selected}
                candidateCursor={catalogue.candidateCursor}
                busy={catalogue.busy}
                error={catalogue.error}
                errorMessage={catalogue.errorMessage}
                stale={catalogue.stale}
                dirty={catalogue.dirty}
                duplicateSelection={catalogue.duplicateSelection}
                writeUncertain={catalogue.writeUncertain}
                locale={locale}
                onChoose={catalogue.choose}
                onSearch={catalogue.searchCandidates}
                onSave={catalogue.saveDraft}
                onPreview={preparePreview}
              />
            ) : (
              <p role={catalogue.error ? 'alert' : 'status'}>
                {catalogue.errorMessage ??
                  t(catalogue.error ? 'deliveryChannels.errors.load' : 'deliveryChannels.loading')}
              </p>
            ))}
          {activeStep === 'publish' && catalogue.catalogue && (
            <DeliveryChannelPublicationPanel
              preview={publication.preview}
              publication={publication.publication}
              busy={publication.busy}
              error={publication.error}
              requestError={publication.requestError}
              canPublish={publication.canPublish}
              unresolvedPublication={publication.unresolvedPublication}
              writeUncertain={publication.writeUncertain}
              storeName={summary.storeDisplayName}
              storeId={summary.storeId}
              incomingOrdersEnabled={summary.isOrderManager && !summary.requireManualAcceptance}
              locale={locale}
              onPublish={publication.publish}
              onCheckPublication={publication.refreshPublication}
            />
          )}
        </>
      )}

      {connected && overview.availability && (
        <DeliveryChannelAvailabilityPanel
          summary={summary}
          availability={overview.availability}
          stale={overview.availabilityStale}
          locale={locale}
          busy={operations.busy}
          canWrite={operations.canWrite}
          statusCheckRequired={operations.statusCheckRequired}
          feedback={operations.feedback}
          onPause={operations.pause}
          onResume={operations.resume}
          onReadStatus={operations.readStatus}
        />
      )}
    </main>
  );
}
