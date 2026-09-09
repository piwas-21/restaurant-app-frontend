'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import { matchesFilters, useMenuFilters } from '@/hooks/menu/useMenuFilters';
import { MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import { groupedBundlesFor } from '@/hooks/publicMenu/mappers';
import { onePageSectionId, type UseOnePageMenuReturn } from '@/hooks/useOnePageMenu';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import DefaultMenuSectionStatus from '@/components/menu/MenuSectionStatus';
import { surfaceOr } from '@/templates/resolve-surface';
import MenuFilters from '@/components/menu/MenuFilters';
import MenuList from '@/components/menu/MenuList';
import styles from './MenuOnePage.module.css';

// The active template's status override (craft's Amatic heading + kraft skeleton)
// or the shared default (classic) — resolved at build time, so classic never
// bundles the craft version (T4). The sections use the SAME surface the tabs
// layout renders through, so a template skins both layouts without new slots.
const MenuSectionStatus = surfaceOr('MenuSectionStatus', DefaultMenuSectionStatus);

interface MenuOnePageProps {
  /** `useOnePageMenu()` — sections, bundles and the jump-to-section controller. */
  controller: UseOnePageMenuReturn;
  /** Opens the shared customization sheet, which the page owns (both layouts). */
  onOpenItem: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  /** Card "Switch to X" — the page's follow-up instance, as on the tabs layout. */
  onSwitchOrderType?: (type: OrderType) => void;
  /** The Chef's Special hero — first cell of the FIRST section's grid. */
  featuredSlot?: ReactNode;
  /** The special's own filter data, so it filters with its section (see MenuContent). */
  featuredFilterable?: { allergens?: string[]; isSpecial?: boolean };
}

/**
 * The one-page layout body: one section per category in nav order, then ONE bundles
 * section. Deliberate placement decisions (stated in the PR):
 *
 *  - **Sections mirror their category tab: dishes PLUS the bundles listed in that
 *    category** — the SAME `groupedBundlesFor` mapping the tabs grid uses, so a combo
 *    the admin listed under two categories prints under both sections, exactly as it
 *    prints under both tabs. The bundles listing at the foot stays too (the Bundles
 *    tab's counterpart), so a bundle shows once per placement its `categoryIds` name
 *    plus the dedicated listing — the tabs layout shows the same card in the same
 *    places.
 *  - **One filter row for the whole page**, above the sections: the chips tally every
 *    loaded dish, and each section filters itself with the same active set. A row per
 *    section would be N copies of the same controls.
 *  - **No pagination and no per-section count line**: one section holds one whole
 *    category under the same 200-item bound the tabs view filters against.
 *  - A section the active chips empty is skipped entirely — on a page this long, a
 *    run of "nothing matches" headings under a sticky bar reads as breakage.
 */
export default function MenuOnePage({
  controller,
  onOpenItem,
  onSwitchOrderType,
  featuredSlot,
  featuredFilterable,
}: Readonly<MenuOnePageProps>) {
  const { t } = useTranslation();
  const { sections, menuBundles, bundlesState, refetchCategory, refetchBundles } = controller;

  const allItems = useMemo(
    () => [...sections.flatMap((section) => section.state.items), ...menuBundles],
    [sections, menuBundles],
  );
  const filters = useMenuFilters(allItems);
  const isFiltered = filters.activeIds.size > 0;
  const anyLoading = sections.some((section) => section.state.isLoading) || bundlesState.isLoading;

  const heroVisible = !featuredFilterable || matchesFilters(featuredFilterable, filters.activeIds);

  const visibleBundles = useMemo(
    () => menuBundles.filter((bundle) => matchesFilters(bundle, filters.activeIds)),
    [menuBundles, filters.activeIds],
  );
  // No bundles at all is the tenant's state, not a state panel: an always-present empty
  // section at the foot of the page reads as a hole. Skeleton and error still render —
  // they are transient — and chips that empty the listing hide it like any other section.
  const showBundlesSection = bundlesState.isLoading || bundlesState.error !== null || menuBundles.length > 0;

  // Every card the page prints, each entity counted ONCE: a combo listed in two
  // categories prints three times (both sections + the bundles listing, exactly the
  // placements the tabs layout offers), but the "N of M dishes" sentence counts dishes,
  // not placements — so `shown` can never exceed the loaded `total`.
  const shownCount = useMemo(() => {
    const shown = new Set<string>();
    for (const { category, state } of sections) {
      for (const item of state.items) {
        if (matchesFilters(item, filters.activeIds)) shown.add(item.id);
      }
      for (const bundle of groupedBundlesFor(category.id, false, false, false, menuBundles)) {
        if (matchesFilters(bundle, filters.activeIds)) shown.add(bundle.id);
      }
    }
    for (const bundle of menuBundles) {
      if (matchesFilters(bundle, filters.activeIds)) shown.add(bundle.id);
    }
    return shown.size;
  }, [sections, menuBundles, filters.activeIds]);

  return (
    <div>
      {/* One chip row for the whole page — hidden until every pipeline has settled, so
          the tallies never print against a half-loaded menu. */}
      {!anyLoading && filters.options.length > 0 && (
        <div className={styles.onePageFilters}>
          <MenuFilters
            options={filters.options}
            activeIds={filters.activeIds}
            onToggle={filters.toggle}
            onClear={filters.clear}
            shown={shownCount}
            total={filters.totalLoaded}
          />
        </div>
      )}

      {sections.map(({ category, state }, index) => {
        const visible = state.items.filter((item) => matchesFilters(item, filters.activeIds));
        // The SAME mapping a category tab feeds its grid (`groupedBundlesFor` over the
        // bundle's own admin-assigned `categoryIds`) — so a combo listed under two
        // categories lands in both sections here, as it does under both tabs. Order-type
        // dimming rides each bundle's own `availability` through the card, the same
        // channel a tab uses; no per-section verdict is computed here.
        const sectionBundles = groupedBundlesFor(category.id, false, false, false, menuBundles);
        const visibleSectionBundles = sectionBundles.filter((bundle) => matchesFilters(bundle, filters.activeIds));
        // Under active chips an empty section is NOISE, not information — the chip row
        // already says how much survives overall. Without chips, "no dishes here yet"
        // is the tenant's true state and stays visible (same rule as a tab).
        if (isFiltered && visible.length === 0 && visibleSectionBundles.length === 0) return null;
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
              errorMessage={state.error ? t('error_loading_menu_items') : null}
              isEmpty={
                !state.isLoading &&
                !state.error &&
                state.items.length === 0 &&
                sectionBundles.length === 0 &&
                // While the bundles pipeline is in flight `menuBundles` is deliberately
                // empty, so a zero-dish category WITH assigned bundles would flash
                // "No dishes here yet" before its combo cards land. A loading pipeline
                // is "not yet known", not "truly empty".
                !bundlesState.isLoading
              }
              loadingMessage={t('loading_items', 'Loading items...')}
              emptyMessage={t('no_items_in_category', { categoryName: category.name })}
              emptyHeading={
                isFiltered
                  ? t('menu_state_filtered_heading', 'Nothing matches')
                  : t('menu_state_empty_heading', 'No dishes here yet')
              }
              errorHeading={t('menu_state_error_heading', 'Unable to load menu')}
              retryLabel={t('retry', 'Retry')}
              browseLabel={t('browse_full_menu', 'Browse full menu')}
              onRetry={state.error ? () => refetchCategory(category.id) : undefined}
            />
            {!state.isLoading && !state.error && (visible.length > 0 || visibleSectionBundles.length > 0) && (
              <MenuList
                products={visible}
                bundles={visibleSectionBundles}
                onOpenItem={onOpenItem}
                onFeedbackSuccess={() => {}}
                onSwitchOrderType={onSwitchOrderType}
                featuredSlot={index === 0 && heroVisible ? featuredSlot : undefined}
              />
            )}
          </section>
        );
      })}

      {showBundlesSection && !(isFiltered && visibleBundles.length === 0) && (
        <section
          id={onePageSectionId(MENU_BUNDLES_KEY)}
          className={`${styles.section} ${styles.bundlesDivider}`}
          aria-labelledby={`category-heading-${MENU_BUNDLES_KEY}`}
        >
          <MenuSectionStatus
            headingId={`category-heading-${MENU_BUNDLES_KEY}`}
            title={t('menu_bundles')}
            isLoading={bundlesState.isLoading}
            errorMessage={bundlesState.error ? t('error_loading_menu_bundles') : null}
            isEmpty={!bundlesState.isLoading && !bundlesState.error && visibleBundles.length === 0}
            loadingMessage={t('loading_menu_bundles')}
            emptyMessage={t('no_bundles_available')}
            emptyHeading={t('menu_state_empty_heading', 'No dishes here yet')}
            errorHeading={t('menu_state_error_heading', 'Unable to load menu')}
            retryLabel={t('retry', 'Retry')}
            browseLabel={t('browse_full_menu', 'Browse full menu')}
            onRetry={bundlesState.error ? refetchBundles : undefined}
          />
          {!bundlesState.isLoading && !bundlesState.error && (
            <MenuList
              products={[]}
              bundles={visibleBundles}
              onOpenItem={onOpenItem}
              onFeedbackSuccess={() => {}}
              onSwitchOrderType={onSwitchOrderType}
            />
          )}
        </section>
      )}
    </div>
  );
}
