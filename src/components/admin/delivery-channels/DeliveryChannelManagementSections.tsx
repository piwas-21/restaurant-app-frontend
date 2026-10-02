'use client';

import { useTranslation } from 'react-i18next';
import type { DeliveryChannelWorkspaceSectionId } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';
import DeliveryChannelAvailabilityPanel from './DeliveryChannelAvailabilityPanel';
import DeliveryChannelCataloguePanel from './DeliveryChannelCataloguePanel';
import DeliveryChannelConnectionPanel from './DeliveryChannelConnectionPanel';
import DeliveryChannelExceptionInbox from './DeliveryChannelExceptionInbox';
import DeliveryChannelOverviewPanel from './DeliveryChannelOverviewPanel';
import DeliveryChannelPublicationPanel from './DeliveryChannelPublicationPanel';
import type { useDeliveryChannelCatalogue } from '@/hooks/admin/useDeliveryChannelCatalogue';
import type { useDeliveryChannelOperations } from '@/hooks/admin/useDeliveryChannelOperations';
import type { useDeliveryChannelOverview } from '@/hooks/admin/useDeliveryChannelOverview';
import type { useDeliveryChannelPublication } from '@/hooks/admin/useDeliveryChannelPublication';
import styles from './DeliveryChannelManagementSections.module.css';

interface Props {
  readonly activeSection: DeliveryChannelWorkspaceSectionId;
  readonly summary: DeliveryChannelManagementSummary;
  readonly locale: string;
  readonly connected: boolean;
  readonly overview: ReturnType<typeof useDeliveryChannelOverview>;
  readonly catalogue: ReturnType<typeof useDeliveryChannelCatalogue>;
  readonly publication: ReturnType<typeof useDeliveryChannelPublication>;
  readonly operations: ReturnType<typeof useDeliveryChannelOperations>;
  readonly onSectionChange: (section: DeliveryChannelWorkspaceSectionId) => void;
  readonly onConnectionRefresh: () => Promise<boolean>;
  readonly onPreview: () => Promise<boolean>;
}

const PANEL_ID_PREFIX = 'delivery-channel-workspace';

function SectionPanel({
  section,
  activeSection,
  children,
}: {
  readonly section: DeliveryChannelWorkspaceSectionId;
  readonly activeSection: DeliveryChannelWorkspaceSectionId;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      id={`${PANEL_ID_PREFIX}-section-panel-${section}`}
      role="tabpanel"
      aria-labelledby={`${PANEL_ID_PREFIX}-section-tab-${section}`}
      hidden={activeSection !== section}
      tabIndex={0}
      className={styles.sectionPanel}
    >
      {children}
    </div>
  );
}

export default function DeliveryChannelManagementSections({
  activeSection,
  summary,
  locale,
  connected,
  overview,
  catalogue,
  publication,
  operations,
  onSectionChange,
  onConnectionRefresh,
  onPreview,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const catalogueFallback = catalogue.error ? (
    <p role="alert">{catalogue.errorMessage ?? t('deliveryChannels.errors.load')}</p>
  ) : (
    <p>
      <output>{t('deliveryChannels.loading')}</output>
    </p>
  );

  return (
    <div className={styles.panels}>
      <SectionPanel section="overview" activeSection={activeSection}>
        <DeliveryChannelOverviewPanel
          summary={summary}
          exceptions={overview.exceptions}
          checkedAt={summary.checkedAt}
          stale={overview.isStale}
          locale={locale}
          onNavigate={onSectionChange}
        />
      </SectionPanel>

      <SectionPanel section="connection" activeSection={activeSection}>
        <DeliveryChannelConnectionPanel
          summary={summary}
          locale={locale}
          busy={operations.busy}
          canWrite={operations.canWrite}
          menuProviderVerified={publication.verified}
          feedback={operations.feedback}
          onDisconnect={operations.disconnect}
          onRefresh={onConnectionRefresh}
        />
      </SectionPanel>

      <SectionPanel section="menu" activeSection={activeSection}>
        {!connected && (
          <div className={styles.prerequisite}>
            <h2>{t('deliveryChannels.workspace.connectFirstTitle')}</h2>
            <p>{t('deliveryChannels.workspace.connectFirstBody')}</p>
            <button type="button" onClick={() => onSectionChange('connection')}>
              {t('deliveryChannels.workspace.connectFirstAction')}
            </button>
          </div>
        )}
        <fieldset disabled={!connected} className={styles.catalogueFieldset}>
          <legend className={styles.srOnly}>{t('deliveryChannels.workspace.menu')}</legend>
          {catalogue.catalogue ? (
            <DeliveryChannelCataloguePanel
              catalogue={catalogue.catalogue}
              candidates={catalogue.candidates}
              knownCandidates={catalogue.knownCandidates}
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
              onPreview={onPreview}
            />
          ) : (
            catalogueFallback
          )}
        </fieldset>
      </SectionPanel>

      <SectionPanel section="publish" activeSection={activeSection}>
        {!connected && (
          <div className={styles.prerequisite}>
            <h2>{t('deliveryChannels.workspace.connectFirstTitle')}</h2>
            <p>{t('deliveryChannels.workspace.connectFirstBody')}</p>
            <button type="button" onClick={() => onSectionChange('connection')}>
              {t('deliveryChannels.workspace.connectFirstAction')}
            </button>
          </div>
        )}
        {connected && !publication.preview && (
          <div className={styles.prerequisite}>
            <h2>{t('deliveryChannels.workspace.reviewFirstTitle')}</h2>
            <p>{t('deliveryChannels.workspace.reviewFirstBody')}</p>
            <button type="button" onClick={() => onSectionChange('menu')}>
              {t('deliveryChannels.workspace.reviewFirstAction')}
            </button>
          </div>
        )}
        <DeliveryChannelPublicationPanel
          preview={publication.preview}
          publication={publication.publication}
          busy={publication.busy}
          error={publication.error}
          requestError={publication.requestError}
          canPublish={connected && publication.canPublish}
          unresolvedPublication={publication.unresolvedPublication}
          writeUncertain={publication.writeUncertain}
          storeName={summary.storeDisplayName}
          storeId={summary.storeId}
          incomingOrdersEnabled={summary.isOrderManager && !summary.requireManualAcceptance}
          locale={locale}
          onPublish={publication.publish}
          onCheckPublication={publication.refreshPublication}
        />
      </SectionPanel>

      <SectionPanel section="availability" activeSection={activeSection}>
        <DeliveryChannelAvailabilityPanel
          summary={summary}
          availability={overview.availability}
          stale={overview.availabilityStale}
          locale={locale}
          connected={connected}
          busy={operations.busy}
          canWrite={operations.canWrite}
          statusCheckRequired={operations.statusCheckRequired}
          feedback={operations.feedback}
          onPause={operations.pause}
          onResume={operations.resume}
          onReadStatus={operations.readStatus}
          onConnect={() => onSectionChange('connection')}
        />
      </SectionPanel>

      <SectionPanel section="exceptions" activeSection={activeSection}>
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
      </SectionPanel>
    </div>
  );
}
