import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem, CatalogOfferFamily } from '@/types/menu';
import type { UsePublicOfferFamiliesReturn } from '@/hooks/usePublicOfferFamilies';
import type { MenuContentProps } from './MenuContent';
import { ALL_ITEMS_KEY } from '@/hooks/usePublicMenu';
import { matchesFilters, useMenuFilters } from '@/hooks/menu/useMenuFilters';
import DefaultMenuSectionStatus from '@/components/menu/MenuSectionStatus';
import MenuFilters from '@/components/menu/MenuFilters';
import MenuList from '@/components/menu/MenuList';
import { toOfferFamilyFilterItem } from '@/utils/offerFamily';
import { surfaceOr } from '@/templates/resolve-surface';

const MenuSectionStatus = surfaceOr('MenuSectionStatus', DefaultMenuSectionStatus);

interface MenuFamilyContentProps {
  selectedView: MenuContentProps['selectedView'];
  categoryDisplayName: string;
  categoryDescription?: string;
  families: CatalogOfferFamily[];
  state: UsePublicOfferFamiliesReturn;
  onOpenItem: MenuContentProps['onOpenItem'];
  onSwitchOrderType?: MenuContentProps['onSwitchOrderType'];
  featuredSlot?: ReactNode;
  featuredFilterable?: MenuContentProps['featuredFilterable'];
}

/** Renders the aggregate family list for both tabs and one-page category-offer paths. */
export default function MenuFamilyContent({
  selectedView,
  categoryDisplayName,
  categoryDescription,
  families,
  state,
  onOpenItem,
  onSwitchOrderType,
  featuredSlot,
  featuredFilterable,
}: Readonly<MenuFamilyContentProps>) {
  const { t } = useTranslation();
  const isAllView = selectedView === ALL_ITEMS_KEY;
  const familiesForView = families.filter((family) => isAllView || family.categoryIds.includes(selectedView));
  const cards = familiesForView.map(toOfferFamilyFilterItem);
  const filters = useMenuFilters(cards);
  const displayItems = filters.filtered;
  const isFiltered = filters.activeIds.size > 0;
  const displayError = state.error ? t('error_loading_menu_items') : null;
  const displayFamilies = displayItems
    .filter(isCatalogItem)
    .map((item) => item.offerFamily)
    .filter(isFamily);
  const showFeatured = !featuredFilterable || matchesFilters(featuredFilterable, filters.activeIds);

  return (
    <section data-testid="menu-grid" aria-labelledby={`category-heading-${selectedView}`}>
      <MenuSectionStatus
        headingId={`category-heading-${selectedView}`}
        title={categoryDisplayName}
        description={categoryDescription}
        isLoading={state.isLoading}
        errorMessage={displayError}
        isEmpty={!state.isLoading && !displayError && displayItems.length === 0}
        loadingMessage={t('loading_items', 'Loading items...')}
        emptyMessage={
          isFiltered
            ? t('menu_filters_none', 'No dishes match these filters')
            : t('no_items_in_category', { categoryName: categoryDisplayName })
        }
        emptyHeading={
          isFiltered
            ? t('menu_state_filtered_heading', 'Nothing matches')
            : t('menu_state_empty_heading', 'No dishes here yet')
        }
        errorHeading={t('menu_state_error_heading', 'Unable to load menu')}
        retryLabel={t('retry', 'Retry')}
        browseLabel={t('browse_full_menu', 'Browse full menu')}
        onRetry={state.refetch}
        filtersSlot={
          !displayError && (
            <MenuFilters
              options={filters.options}
              activeIds={filters.activeIds}
              onToggle={filters.toggle}
              onClear={filters.clear}
              shown={displayItems.length}
              total={filters.totalLoaded}
            />
          )
        }
      />

      {!state.isLoading && !displayError && displayFamilies.length > 0 && (
        <MenuList
          products={[]}
          bundles={[]}
          families={displayFamilies}
          onOpenItem={onOpenItem}
          onFeedbackSuccess={() => {}}
          onSwitchOrderType={onSwitchOrderType}
          offerFamilyFilterIds={filters.activeIds}
          featuredSlot={showFeatured ? featuredSlot : undefined}
        />
      )}
    </section>
  );
}

function isCatalogItem(value: CatalogItem): value is CatalogItem & { offerFamily: CatalogOfferFamily } {
  return value.offerFamily !== undefined;
}

function isFamily(value: CatalogOfferFamily | undefined): value is CatalogOfferFamily {
  return value !== undefined;
}
