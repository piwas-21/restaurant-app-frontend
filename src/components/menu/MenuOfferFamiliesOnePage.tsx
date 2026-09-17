'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem, CatalogOfferFamily, ApiCategory } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import type { UsePublicOfferFamiliesReturn } from '@/hooks/usePublicOfferFamilies';
import { matchesFilters, useMenuFilters } from '@/hooks/menu/useMenuFilters';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import DefaultMenuSectionStatus from '@/components/menu/MenuSectionStatus';
import { surfaceOr } from '@/templates/resolve-surface';
import MenuFilters from '@/components/menu/MenuFilters';
import MenuList from '@/components/menu/MenuList';
import { onePageSectionId } from '@/hooks/useOnePageMenu';
import styles from './MenuOnePage.module.css';
import { toOfferFamilyFilterItem } from '@/utils/offerFamily';

const MenuSectionStatus = surfaceOr('MenuSectionStatus', DefaultMenuSectionStatus);

interface MenuOfferFamiliesOnePageProps {
  categories: ApiCategory[];
  families: CatalogOfferFamily[];
  state: UsePublicOfferFamiliesReturn;
  onOpenItem: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  onSwitchOrderType?: (type: OrderType) => void;
  featuredSlot?: ReactNode;
  featuredFilterable?: { allergens?: string[]; isSpecial?: boolean };
}

/** One-page renderer for the aggregate path; no technical Menu Bundles footer exists here. */
export default function MenuOfferFamiliesOnePage({
  categories,
  families,
  state,
  onOpenItem,
  onSwitchOrderType,
  featuredSlot,
  featuredFilterable,
}: Readonly<MenuOfferFamiliesOnePageProps>) {
  const { t } = useTranslation();
  const displayError = state.error ? t('error_loading_menu_items') : null;
  // Category-linked families stay visible in their exact sections even when hidden from All. An
  // unlinked family has no exact placement, so its fallback "Other offers" section follows the All
  // visibility verdict and does not reintroduce a family the tenant deliberately hid.
  const cards = useMemo(
    () =>
      families
        .filter((family) => family.categoryIds.length > 0 || family.visibleInAll !== false)
        .map(toOfferFamilyFilterItem),
    [families],
  );
  const filters = useMenuFilters(cards);
  const isFiltered = filters.activeIds.size > 0;
  const heroVisible = !featuredFilterable || matchesFilters(featuredFilterable, filters.activeIds);
  const categorylessFamilies = families.filter(
    (family) => family.categoryIds.length === 0 && family.visibleInAll !== false,
  );
  const visibleCategorylessFamilies = categorylessFamilies.filter((family) =>
    matchesFilters(toOfferFamilyFilterItem(family), filters.activeIds),
  );

  if (state.isLoading && families.length === 0) {
    return (
      <MenuSectionStatus
        headingId="category-heading-all"
        title={t('all_categories_nav')}
        isLoading
        errorMessage={null}
        isEmpty={false}
        loadingMessage={t('loading_items')}
        emptyMessage={t('no_items_in_category', { categoryName: t('all_categories_nav') })}
        emptyHeading={t('menu_state_empty_heading')}
        errorHeading={t('menu_state_error_heading')}
        retryLabel={t('retry')}
        browseLabel={t('browse_full_menu')}
      />
    );
  }
  if (displayError && families.length === 0) {
    return (
      <MenuSectionStatus
        headingId="category-heading-all"
        title={t('all_categories_nav')}
        isLoading={false}
        errorMessage={displayError}
        isEmpty={false}
        loadingMessage={t('loading_items')}
        emptyMessage={t('no_items_in_category', { categoryName: t('all_categories_nav') })}
        emptyHeading={t('menu_state_empty_heading')}
        errorHeading={t('menu_state_error_heading')}
        retryLabel={t('retry')}
        browseLabel={t('browse_full_menu')}
        onRetry={state.refetch}
      />
    );
  }

  return (
    <div>
      {!state.isLoading && filters.options.length > 0 && (
        <div className={styles.onePageFilters}>
          <MenuFilters
            options={filters.options}
            activeIds={filters.activeIds}
            onToggle={filters.toggle}
            onClear={filters.clear}
            shown={filters.filtered.length}
            total={filters.totalLoaded}
          />
        </div>
      )}

      {categories.map((category, index) => {
        const categoryFamilies = families.filter((family) => family.categoryIds.includes(category.id));
        const visibleFamilies = categoryFamilies.filter((family) => {
          const card = toOfferFamilyFilterItem(family);
          return matchesFilters(card, filters.activeIds);
        });
        if (isFiltered && visibleFamilies.length === 0) return null;
        return (
          <section
            key={category.id}
            id={onePageSectionId(category.id)}
            className={styles.section}
            aria-labelledby={`category-heading-${category.id}`}
          >
            <MenuSectionStatus
              headingId={`category-heading-${category.id}`}
              title={getCategoryDisplayName(category.name, t)}
              description={category.description}
              isLoading={state.isLoading}
              errorMessage={displayError}
              isEmpty={!state.isLoading && !displayError && visibleFamilies.length === 0}
              loadingMessage={t('loading_items')}
              emptyMessage={t('no_items_in_category', { categoryName: category.name })}
              emptyHeading={isFiltered ? t('menu_state_filtered_heading') : t('menu_state_empty_heading')}
              errorHeading={t('menu_state_error_heading')}
              retryLabel={t('retry')}
              browseLabel={t('browse_full_menu')}
              onRetry={displayError ? state.refetch : undefined}
            />
            {!state.isLoading && !displayError && visibleFamilies.length > 0 && (
              <MenuList
                products={[]}
                bundles={[]}
                families={visibleFamilies}
                onOpenItem={onOpenItem}
                onFeedbackSuccess={() => {}}
                onSwitchOrderType={onSwitchOrderType}
                offerFamilyFilterIds={filters.activeIds}
                featuredSlot={index === 0 && heroVisible ? featuredSlot : undefined}
              />
            )}
          </section>
        );
      })}

      {categorylessFamilies.length > 0 && (!isFiltered || visibleCategorylessFamilies.length > 0) && (
        <section
          id={onePageSectionId('offer-family-other')}
          className={styles.section}
          aria-labelledby="category-heading-offer-family-other"
        >
          <MenuSectionStatus
            headingId="category-heading-offer-family-other"
            title={t('offer_family_other_category')}
            description={undefined}
            isLoading={state.isLoading}
            errorMessage={displayError}
            isEmpty={!state.isLoading && !displayError && visibleCategorylessFamilies.length === 0}
            loadingMessage={t('loading_items')}
            emptyMessage={t('no_items_in_category', { categoryName: t('offer_family_other_category') })}
            emptyHeading={isFiltered ? t('menu_state_filtered_heading') : t('menu_state_empty_heading')}
            errorHeading={t('menu_state_error_heading')}
            retryLabel={t('retry')}
            browseLabel={t('browse_full_menu')}
            onRetry={displayError ? state.refetch : undefined}
          />
          {!state.isLoading && !displayError && visibleCategorylessFamilies.length > 0 && (
            <MenuList
              products={[]}
              bundles={[]}
              families={visibleCategorylessFamilies}
              onOpenItem={onOpenItem}
              onFeedbackSuccess={() => {}}
              onSwitchOrderType={onSwitchOrderType}
              offerFamilyFilterIds={filters.activeIds}
            />
          )}
        </section>
      )}
    </div>
  );
}
