import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuItem, MenuBundleItem, ApiCategory, CatalogItem } from '@/types/menu';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import DefaultCategoryNav from '@/components/menu/CategoryNav';
import MenuList from '@/components/menu/MenuList';
import Pagination from '@/components/common/Pagination';
import { surfaceOr } from '@/templates/resolve-surface';
import styles from './MenuContent.module.css';

// The active template's category-nav override (craft = masking-tape tabs) or the
// shared default (classic) — resolved at build time, so classic never bundles the
// craft nav (T4).
const CategoryNav = surfaceOr('CategoryNav', DefaultCategoryNav);

interface MenuContentProps {
  categoriesForNav: ApiCategory[];
  selectedView: string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY;
  onSelectView: (view: string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY) => void;
  categoryDisplayName: string;
  isLoadingItems: boolean;
  errorLoadingItems: string | null;
  currentMenuItems: MenuItem[];
  menuBundles: MenuBundleItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Opens the shared customization sheet, which the page owns. */
  onOpenItem: (item: CatalogItem) => void;
}

export default function MenuContent({
  categoriesForNav,
  selectedView,
  onSelectView,
  categoryDisplayName,
  isLoadingItems,
  errorLoadingItems,
  currentMenuItems,
  menuBundles,
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  onOpenItem,
}: MenuContentProps) {
  const { t } = useTranslation();

  const isMenuBundlesView = selectedView === MENU_BUNDLES_KEY;
  const displayItems = isMenuBundlesView ? menuBundles : currentMenuItems;

  const displayError = errorLoadingItems
    ? t(
        selectedView === ALL_ITEMS_KEY
          ? 'error_loading_all_menu_items'
          : isMenuBundlesView
            ? 'error_loading_menu_bundles'
            : 'error_loading_menu_items',
        { categoryName: categoryDisplayName },
      )
    : null;

  const emptyMessage = isMenuBundlesView
    ? t('no_bundles_available')
    : t('no_items_in_category', { categoryName: categoryDisplayName });

  const loadingMessage = isMenuBundlesView ? t('loading_menu_bundles') : t('loading_items', 'Loading items...');

  return (
    <>
      {/* Category Navigation */}
      {categoriesForNav.length > 0 && (
        <CategoryNav
          categories={categoriesForNav}
          selectedView={selectedView}
          onSelect={onSelectView}
          allLabel={t('all_categories_nav')}
        />
      )}

      {/* Menu Items Section */}
      <section className={styles.categorySection} aria-labelledby={`category-heading-${selectedView}`}>
        <h2 id={`category-heading-${selectedView}`} className={styles.categoryTitle}>
          {categoryDisplayName}
        </h2>

        {/* Loading State */}
        {isLoadingItems && <p>{loadingMessage}</p>}

        {/* Error State */}
        {displayError && <p className={styles.errorMessage}>{displayError}</p>}

        {/* Empty State */}
        {!isLoadingItems && !displayError && displayItems.length === 0 && <p>{emptyMessage}</p>}

        {/* Menu Items or Bundles — one grid, one card; the view only picks which list feeds it. */}
        {!isLoadingItems && !displayError && displayItems.length > 0 && (
          <>
            <MenuList
              products={isMenuBundlesView ? [] : currentMenuItems}
              bundles={isMenuBundlesView ? menuBundles : []}
              onOpenItem={onOpenItem}
              onFeedbackSuccess={() => {}}
            />

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              isLoading={isLoadingItems}
            />

            {/* Pagination Info */}
            {totalCount > 0 && (
              <p className={styles.paginationInfo}>
                {t('showing_items', {
                  start: (currentPage - 1) * 10 + 1,
                  end: Math.min(currentPage * 10, totalCount),
                  total: totalCount,
                  defaultValue: `Showing ${(currentPage - 1) * 10 + 1}-${Math.min(currentPage * 10, totalCount)} of ${totalCount} items`,
                })}
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
