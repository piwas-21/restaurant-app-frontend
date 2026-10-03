'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryInventory,
} from '@/types/deliveryChannelMenuSelection';
import type { DeliveryChannelCategoryOverrideMap } from '@/utils/deliveryChannelMenuSelection';
import { selectionErrorText } from '@/utils/deliveryChannelCategorySelectionView';
import { useDeliveryChannelCategoryCandidateFilters } from '@/hooks/admin/useDeliveryChannelCategoryCandidateFilters';
import DeliveryChannelCategoryItems from './DeliveryChannelCategoryItems';
import DeliveryChannelCategoryList from './DeliveryChannelCategoryList';
import DeliveryChannelCategoryStatusNotices from './DeliveryChannelCategoryStatusNotices';
import DeliveryChannelServiceHoursReview from './DeliveryChannelServiceHoursReview';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelCategorySelectionPanel.module.css';

interface Props {
  readonly inventory: DeliveryChannelCategoryInventory;
  readonly catalogue: DeliveryChannelCatalogue;
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: DeliveryChannelCategoryOverrideMap;
  readonly candidates: readonly DeliveryChannelCategoryCandidate[];
  readonly cursor: string | null;
  readonly selectedCount: number;
  readonly unsupportedCount: number;
  readonly busy: 'load' | 'save' | null;
  readonly candidateBusy: boolean;
  readonly candidateError: boolean;
  readonly error:
    'load' | 'selectionLimit' | 'categoryLimit' | 'overrideLimit' | 'stale' | 'uncertain' | 'rejected' | null;
  readonly loadErrorMessage: string | null;
  readonly removedSelectionNotice: boolean;
  readonly needsSave: boolean;
  readonly stale: boolean;
  readonly writeUncertain: boolean;
  readonly locale: string;
  readonly onSearch: (query: string, categoryId: string | null) => Promise<boolean>;
  readonly onLoadMore: () => Promise<boolean>;
  readonly onToggleCategory: (categoryId: string, selected: boolean) => void;
  readonly onToggleItem: (item: DeliveryChannelCategoryCandidate, selected: boolean) => void;
  readonly onSave: () => Promise<boolean>;
  readonly onRefresh: () => Promise<boolean>;
  readonly onPreview: () => Promise<boolean>;
}

export default function DeliveryChannelCategorySelectionPanel({
  inventory,
  catalogue,
  categoryIds,
  overrides,
  candidates,
  cursor,
  selectedCount,
  unsupportedCount,
  busy,
  candidateBusy,
  candidateError,
  error,
  loadErrorMessage,
  removedSelectionNotice,
  needsSave,
  stale,
  writeUncertain,
  locale,
  onSearch,
  onLoadMore,
  onToggleCategory,
  onToggleItem,
  onSave,
  onRefresh,
  onPreview,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const { query, setQuery, appliedQuery, categoryFilter, search, changeCategory } =
    useDeliveryChannelCategoryCandidateFilters(inventory.sourceRevision, inventory.categories, onSearch);
  const busyNow = busy !== null || candidateBusy;
  const errorText =
    error === 'load' && loadErrorMessage
      ? loadErrorMessage
      : selectionErrorText(t, error, selectedCount, {
          selectedItems: inventory.maximumSelectedItemCount,
          categories: inventory.maximumCategoryCount,
        });
  const previewDisabled = needsSave || stale || writeUncertain || busyNow || !inventory.draft;

  return (
    <section className={workspaceStyles.panel} aria-labelledby="delivery-channel-category-selection-title">
      <header className={styles.header}>
        <div>
          <h2 id="delivery-channel-category-selection-title">{t('deliveryChannels.menuSelection.title')}</h2>
          <p>{t('deliveryChannels.menuSelection.description')}</p>
          <p>{t('deliveryChannels.menuSelection.categoryBasisNotice')}</p>
        </div>
        <StatusBadge tone={stale ? 'warning' : 'info'}>
          {t(stale ? 'deliveryChannels.menu.stale' : 'deliveryChannels.menu.sourceTenant')}
        </StatusBadge>
      </header>

      <div className={styles.selectionSummary}>
        <output>{t('deliveryChannels.menuSelection.selectedCount', { count: selectedCount })}</output>
        {unsupportedCount > 0 && (
          <StatusBadge tone="warning">
            {t('deliveryChannels.menuSelection.unsupportedCount', { count: unsupportedCount })}
          </StatusBadge>
        )}
      </div>

      <DeliveryChannelCategoryStatusNotices
        stale={stale}
        removedSelectionNotice={removedSelectionNotice}
        showUnsavedNotice={needsSave && Boolean(inventory.draft) && !stale && !writeUncertain}
        writeUncertain={writeUncertain}
        errorText={errorText}
      />

      <div className={styles.filters}>
        <FormField label={t('deliveryChannels.menuSelection.searchLabel')}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                search();
              }
            }}
          />
        </FormField>
        <FormField label={t('deliveryChannels.menuSelection.categoryFilterLabel')}>
          <select
            value={categoryFilter}
            onChange={(event) => {
              changeCategory(event.target.value);
            }}
          >
            <option value="">{t('deliveryChannels.menuSelection.allCategories')}</option>
            {inventory.categories.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
        <button className={workspaceStyles.secondaryAction} type="button" onClick={search} disabled={busyNow}>
          {candidateBusy ? t('deliveryChannels.loading') : t('deliveryChannels.menu.search')}
        </button>
      </div>

      {candidateError && (
        <p className={styles.error} role="alert">
          {t('deliveryChannels.errors.load')}
        </p>
      )}

      <div className={styles.selectionLayout}>
        <aside className={styles.categoryColumn}>
          <h3>{t('deliveryChannels.menuSelection.category')}</h3>
          <DeliveryChannelCategoryList
            categories={inventory.categories}
            selectedCategoryIds={categoryIds}
            overrides={overrides}
            disabled={busyNow || stale || writeUncertain}
            onToggle={onToggleCategory}
          />
        </aside>
        <section className={styles.itemColumn} aria-labelledby="delivery-channel-category-items-title">
          <h3 id="delivery-channel-category-items-title">{t('deliveryChannels.menuSelection.item')}</h3>
          <DeliveryChannelCategoryItems
            items={candidates}
            selectedCategoryIds={categoryIds}
            overrides={overrides}
            currency={catalogue.currency}
            locale={locale}
            disabled={busyNow || stale || writeUncertain}
            onToggle={onToggleItem}
          />
          {cursor && (
            <button
              className={workspaceStyles.textAction}
              type="button"
              onClick={() => void onLoadMore()}
              disabled={busyNow || appliedQuery !== query}
            >
              {candidateBusy ? t('deliveryChannels.loading') : t('deliveryChannels.menuSelection.loadMore')}
            </button>
          )}
        </section>
      </div>

      <details className={styles.hoursDetails}>
        <summary>{t('deliveryChannels.menuSelection.hoursDetails')}</summary>
        <DeliveryChannelServiceHoursReview
          kind="planned"
          days={catalogue.serviceAvailability}
          status={catalogue.serviceHoursStatus}
          editable={catalogue.serviceHoursEditable}
        />
        <DeliveryChannelServiceHoursReview
          kind="provider"
          days={catalogue.currentServiceAvailability}
          status={catalogue.currentServiceHoursStatus}
        />
      </details>

      <div className={workspaceStyles.actions}>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => void onRefresh()}
          disabled={busyNow}
        >
          {busy === 'load' ? t('deliveryChannels.loading') : t('deliveryChannels.menuSelection.refresh')}
        </button>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => void onSave()}
          disabled={!needsSave || busyNow || stale || writeUncertain}
        >
          {busy === 'save' ? t('deliveryChannels.loading') : t('deliveryChannels.menuSelection.save')}
        </button>
        <button
          className={workspaceStyles.action}
          type="button"
          onClick={() => void onPreview()}
          disabled={previewDisabled}
        >
          {t('deliveryChannels.menu.preparePreview')}
        </button>
      </div>
    </section>
  );
}
