'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryChannelWorkspaceSectionId } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import type { useDeliveryChannelCategorySelection } from '@/hooks/admin/useDeliveryChannelCategorySelection';
import type { useDeliveryChannelCatalogue } from '@/hooks/admin/useDeliveryChannelCatalogue';
import DeliveryChannelCataloguePanel from './DeliveryChannelCataloguePanel';
import DeliveryChannelCategorySelectionPanel from './DeliveryChannelCategorySelectionPanel';
import styles from './DeliveryChannelManagementSections.module.css';

interface Props {
  readonly connected: boolean;
  readonly catalogue: ReturnType<typeof useDeliveryChannelCatalogue>;
  readonly categorySelection: ReturnType<typeof useDeliveryChannelCategorySelection>;
  readonly onSectionChange: (section: DeliveryChannelWorkspaceSectionId) => void;
  readonly onPreview: () => Promise<boolean>;
  readonly locale: string;
}

export default function DeliveryChannelMenuSectionPanel({
  connected,
  catalogue,
  categorySelection,
  onSectionChange,
  onPreview,
  locale,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const catalogueFallback = catalogue.error ? (
    <p role="alert">{catalogue.errorMessage ?? t('deliveryChannels.errors.load')}</p>
  ) : (
    <p>
      <output>{t('deliveryChannels.loading')}</output>
    </p>
  );
  const categoryInventory = categorySelection.inventory
    ? { ...categorySelection.inventory, categories: categorySelection.categories }
    : null;
  let menuContent: ReactNode;
  if (catalogue.catalogue?.selectionMode === 'categoryItemsV1') {
    if (categoryInventory) {
      menuContent = (
        <DeliveryChannelCategorySelectionPanel
          inventory={categoryInventory}
          catalogue={catalogue.catalogue}
          categoryIds={categorySelection.categoryIds}
          overrides={categorySelection.overrides}
          candidates={categorySelection.candidates}
          cursor={categorySelection.candidateCursor}
          selectedCount={categorySelection.selectedCount}
          unsupportedCount={categorySelection.unsupportedCount}
          busy={categorySelection.busy}
          candidateBusy={categorySelection.candidateBusy}
          candidateError={categorySelection.candidateError}
          error={categorySelection.error}
          loadErrorMessage={categorySelection.loadErrorMessage}
          removedSelectionNotice={categorySelection.removedSelectionNotice}
          needsSave={categorySelection.needsSave}
          stale={categorySelection.stale}
          writeUncertain={categorySelection.writeUncertain}
          locale={locale}
          onSearch={categorySelection.searchCandidates}
          onLoadMore={categorySelection.loadMoreCandidates}
          onToggleCategory={categorySelection.toggleCategory}
          onToggleItem={categorySelection.toggleItem}
          onSave={categorySelection.saveDraft}
          onRefresh={categorySelection.acknowledgeSource}
          onPreview={onPreview}
        />
      );
    } else if (categorySelection.error) {
      menuContent = (
        <div role="alert">
          <p>{categorySelection.loadErrorMessage ?? t('deliveryChannels.errors.load')}</p>
          <button type="button" onClick={() => void categorySelection.refresh()}>
            {t('deliveryChannels.menuSelection.refresh')}
          </button>
        </div>
      );
    } else {
      menuContent = (
        <p>
          <output>{t('deliveryChannels.loading')}</output>
        </p>
      );
    }
  } else if (catalogue.catalogue) {
    menuContent = (
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
    );
  } else {
    menuContent = catalogueFallback;
  }

  return (
    <>
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
        {menuContent}
      </fieldset>
    </>
  );
}
