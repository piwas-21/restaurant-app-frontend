import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuItem, MenuBundleItem, CatalogItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import { useMenuFilters } from '@/hooks/menu/useMenuFilters';
import DefaultMenuSectionStatus from '@/components/menu/MenuSectionStatus';
import MenuFilters from '@/components/menu/MenuFilters';
import MenuList from '@/components/menu/MenuList';
import Pagination from '@/components/common/Pagination';
import { surfaceOr } from '@/templates/resolve-surface';
import styles from './MenuContent.module.css';

// The active template's override (craft = Amatic heading / kraft skeleton /
// hand-drawn empty plate) or the shared default (classic) — resolved at build
// time, so classic never bundles the craft version (T4).
const MenuSectionStatus = surfaceOr('MenuSectionStatus', DefaultMenuSectionStatus);

/** Which "could not load" sentence the active view earns. */
function errorKeyFor(selectedView: string, isMenuBundlesView: boolean): string {
  if (selectedView === ALL_ITEMS_KEY) return 'error_loading_all_menu_items';
  return isMenuBundlesView ? 'error_loading_menu_bundles' : 'error_loading_menu_items';
}

interface MenuContentProps {
  selectedView: string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY;
  categoryDisplayName: string;
  /** The tenant's own blurb for this category, when it has one. Blank on most categories. */
  categoryDescription?: string;
  isLoadingItems: boolean;
  errorLoadingItems: string | null;
  currentMenuItems: MenuItem[];
  menuBundles: MenuBundleItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Opens the shared customization sheet, which the page owns. `opts.forceSheet` = view-only. */
  onOpenItem: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  /** Card "Switch to X" — the page's `useOrderTypeFollowUp().pickType`, so the follow-up modal opens. */
  onSwitchOrderType?: (type: OrderType) => void;
  /** Reload the active view — `usePublicMenu().refetch`, behind the error state's Retry button. */
  onRetry?: () => void;
  /** Leave an empty category for the full menu (D5). Not offered when this view IS the full menu. */
  onBrowseFullMenu?: () => void;
  /** The Chef's Special hero — the grid's first cell, spanning two columns. See `MenuList`. */
  featuredSlot?: ReactNode;
}

export default function MenuContent({
  selectedView,
  categoryDisplayName,
  categoryDescription,
  isLoadingItems,
  errorLoadingItems,
  currentMenuItems,
  menuBundles,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onOpenItem,
  onSwitchOrderType,
  onRetry,
  onBrowseFullMenu,
  featuredSlot,
}: MenuContentProps) {
  const { t } = useTranslation();

  const isMenuBundlesView = selectedView === MENU_BUNDLES_KEY;
  // One widened element type, so a single filter instance serves both views. The two lists are
  // never mixed — the view picks exactly one — and the casts below re-narrow at the call site.
  const sourceItems: (MenuItem | MenuBundleItem)[] = isMenuBundlesView ? menuBundles : currentMenuItems;
  const filters = useMenuFilters(sourceItems);
  const displayItems = filters.filtered;
  const isFiltered = filters.activeIds.size > 0;

  const displayError = errorLoadingItems
    ? t(errorKeyFor(selectedView, isMenuBundlesView), { categoryName: categoryDisplayName })
    : null;

  // Two different emptinesses, and telling them apart is the whole point: "this category has no
  // dishes" needs a link to the full menu, while "your filters match nothing" needs the filters
  // cleared — offering "Browse full menu" there would throw away a choice the guest just made.
  const emptyMessage = isFiltered
    ? t('menu_filters_none', 'No dishes match these filters')
    : t(isMenuBundlesView ? 'no_bundles_available' : 'no_items_in_category', {
        categoryName: categoryDisplayName,
      });

  const loadingMessage = isMenuBundlesView ? t('loading_menu_bundles') : t('loading_items', 'Loading items...');

  return (
    <section data-testid="menu-grid" aria-labelledby={`category-heading-${selectedView}`}>
      {/* Heading + loading/error/empty states (craft re-skins this via the slot). */}
      <MenuSectionStatus
        headingId={`category-heading-${selectedView}`}
        title={categoryDisplayName}
        description={categoryDescription}
        isLoading={isLoadingItems}
        errorMessage={displayError}
        isEmpty={displayItems.length === 0}
        loadingMessage={loadingMessage}
        emptyMessage={emptyMessage}
        emptyHeading={
          isFiltered
            ? t('menu_state_filtered_heading', 'Nothing matches')
            : t('menu_state_empty_heading', 'No dishes here yet')
        }
        errorHeading={t('menu_state_error_heading', 'Unable to load menu')}
        retryLabel={t('retry', 'Retry')}
        browseLabel={t('browse_full_menu', 'Browse full menu')}
        onRetry={onRetry}
        // Withheld when the empty view already IS the full menu (the button would take the guest to
        // the page they are looking at) and when a FILTER is what emptied it (clearing the filters
        // is the way back, and it is offered by the filter row itself).
        onBrowseFullMenu={selectedView === ALL_ITEMS_KEY || isFiltered ? undefined : onBrowseFullMenu}
      />

      {/* Between the heading and the grid, as the design places it. Rendered while loading too, so
          the row does not appear under the guest's cursor once the fetch lands. */}
      {!displayError && (
        <MenuFilters
          options={filters.options}
          activeIds={filters.activeIds}
          onToggle={filters.toggle}
          onClear={filters.clear}
          shown={displayItems.length}
          total={filters.totalLoaded}
        />
      )}

      {/* Menu Items or Bundles — one grid, one card; the view only picks which list feeds it. */}
      {!isLoadingItems && !displayError && displayItems.length > 0 && (
        <>
          <MenuList
            products={isMenuBundlesView ? [] : (displayItems as MenuItem[])}
            bundles={isMenuBundlesView ? (displayItems as MenuBundleItem[]) : []}
            onOpenItem={onOpenItem}
            onFeedbackSuccess={() => {}}
            onSwitchOrderType={onSwitchOrderType}
            // The hero belongs to the whole menu, not to a filtered subset: a guest who filtered to
            // "No gluten" must not be shown a promoted dish that has gluten in it.
            featuredSlot={isFiltered ? undefined : featuredSlot}
          />

          {/* Hidden while filtering. The filter runs over the LOADED page, so paging through a
              filtered view would silently change which dishes the filter had even seen. */}
          {!isFiltered && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              isLoading={isLoadingItems}
            />
          )}

          {!isFiltered && totalCount > 0 && (
            <p className={styles.paginationInfo}>
              {t('showing_items', {
                start: (currentPage - 1) * pageSize + 1,
                end: Math.min(currentPage * pageSize, totalCount),
                total: totalCount,
                defaultValue: `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} items`,
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
