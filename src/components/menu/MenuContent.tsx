import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuItem, MenuBundleItem, CatalogItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import DefaultMenuSectionStatus from '@/components/menu/MenuSectionStatus';
import MenuList from '@/components/menu/MenuList';
import Pagination from '@/components/common/Pagination';
import { surfaceOr } from '@/templates/resolve-surface';
import styles from './MenuContent.module.css';

// The active template's override (craft = Amatic heading / kraft skeleton /
// hand-drawn empty plate) or the shared default (classic) — resolved at build
// time, so classic never bundles the craft version (T4).
const MenuSectionStatus = surfaceOr('MenuSectionStatus', DefaultMenuSectionStatus);

interface MenuContentProps {
  selectedView: string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY;
  categoryDisplayName: string;
  isLoadingItems: boolean;
  errorLoadingItems: string | null;
  currentMenuItems: MenuItem[];
  menuBundles: MenuBundleItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Opens the shared customization sheet, which the page owns. `opts.forceSheet` = view-only. */
  onOpenItem: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  /** Card "Switch to X" — the page's `useOrderTypeFollowUp().pickType`, so the follow-up modal opens. */
  onSwitchOrderType?: (type: OrderType) => void;
  /** Reload the active view — `usePublicMenu().refetch`, behind the error state's Retry button. */
  onRetry?: () => void;
  /** Leave an empty category for the full menu (D5). Not offered when this view IS the full menu. */
  onBrowseFullMenu?: () => void;
}

export default function MenuContent({
  selectedView,
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
  onSwitchOrderType,
  onRetry,
  onBrowseFullMenu,
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
      {/* Menu Items Section.
          `data-testid` because E2E-STRATEGY's preferred role+name lookup cannot address this
          section: its accessible name is the translated category label, which is "All" by default
          (too generic to match exactly) and changes with the selected view. `role="list"` is no
          better — the basket rail renders one too once the cart has items. Tests need to reach the
          GRID specifically because the featured-special hero sits ABOVE it and offers a button with
          the same accessible name, so an unscoped `.first()` silently exercises the banner. */}
      {/* No `className` — `styles.categorySection` was one, and `MenuContent.module.css` has never
          declared that class, so this element has been shipping with NO class attribute at all:
          React omits an attribute whose value is `undefined` rather than rendering the string.
          Measured on prod before and after removing it, `getAttribute('class')` is `null` both
          times — which is what proves the reference was inert. Removing it is the fix rather than
          inventing a rule; nothing was ever styled through it. */}
      <section data-testid="menu-grid" aria-labelledby={`category-heading-${selectedView}`}>
        {/* Heading + loading/error/empty states (craft re-skins this via the slot). */}
        <MenuSectionStatus
          headingId={`category-heading-${selectedView}`}
          title={categoryDisplayName}
          isLoading={isLoadingItems}
          errorMessage={displayError}
          isEmpty={displayItems.length === 0}
          loadingMessage={loadingMessage}
          emptyMessage={emptyMessage}
          emptyHeading={t('menu_state_empty_heading', 'No dishes here yet')}
          errorHeading={t('menu_state_error_heading', 'Unable to load menu')}
          retryLabel={t('retry', 'Retry')}
          browseLabel={t('browse_full_menu', 'Browse full menu')}
          onRetry={onRetry}
          // Withheld when the empty view already IS the full menu: the button would take the guest
          // to the page they are looking at, which is worse than no button at all.
          onBrowseFullMenu={selectedView === ALL_ITEMS_KEY ? undefined : onBrowseFullMenu}
        />

        {/* Menu Items or Bundles — one grid, one card; the view only picks which list feeds it. */}
        {!isLoadingItems && !displayError && displayItems.length > 0 && (
          <>
            <MenuList
              products={isMenuBundlesView ? [] : currentMenuItems}
              bundles={isMenuBundlesView ? menuBundles : []}
              onOpenItem={onOpenItem}
              onFeedbackSuccess={() => {}}
              onSwitchOrderType={onSwitchOrderType}
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
