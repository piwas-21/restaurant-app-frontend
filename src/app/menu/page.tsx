'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from '../styles/MenuPage.module.css';
import { useTranslation } from 'react-i18next';
import TableBanner from '@/components/TableBanner';

import { useStickyNavOffset } from '@/hooks/menu/useStickyNavOffset';
import { ALL_ITEMS_KEY, usePublicMenu } from '@/hooks/usePublicMenu';
import { useFeaturedSpecial } from '@/hooks/useFeaturedSpecial';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import { surfaceOr } from '@/templates/resolve-surface';
import { getSelectedViewLabel } from '@/utils/categoryNameMapper';
import type { OrderType } from '@/types/order';

import MenuPageHeader from '@/components/menu/MenuPageHeader';
import MenuContent from '@/components/menu/MenuContent';
import MenuOnePage from '@/components/menu/MenuOnePage';
import MenuOrderOverlays from '@/components/menu/MenuOrderOverlays';
import DefaultCategoryNav from '@/components/menu/CategoryNav';
import DefaultFeaturedSpecial from '@/components/menu/FeaturedSpecial';
import { useCatalogSheet } from '@/hooks/menu/useCatalogSheet';
import { useMenuCart } from '@/hooks/menu/useMenuCart';
import { useMenuDisplaySettings } from '@/hooks/useMenuDisplaySettings';
import { useOnePageMenu } from '@/hooks/useOnePageMenu';
import FloatingCartButton from '@/components/menu/FloatingCartButton';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

// The active template's overrides (craft = ruled-paper order pad, masking-tape tabs) or the
// shared defaults (classic) — resolved at build time, so classic never bundles craft (T4).
// `OrderFlowSidebar` is no longer among them: /menu has no rail, and /cart resolves its own.
const FeaturedSpecialComponent = surfaceOr('FeaturedSpecial', DefaultFeaturedSpecial);
const CategoryNav = surfaceOr('CategoryNav', DefaultCategoryNav);

export default function MenuPage() {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  // The tenant's menu-display settings (mcdoner partner request). `tabs` is the answer until
  // the read settles and on any backend that predates the fields, so the page renders exactly
  // today's tree by default. The settings decide which data pipeline runs BEFORE either is
  // mounted: in the one-page layout the tabs pipeline is stood down and the one-page
  // controller's per-category fetches own the page.
  const displaySettings = useMenuDisplaySettings();
  const isOnePage = displaySettings.menuLayout === 'onepage';
  const {
    categories: categoriesForNav,
    selectedView,
    setSelectedView,
    items: currentMenuItems,
    menuBundles: tabsMenuBundles,
    isLoading: isLoadingItems,
    error: errorLoadingItems,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    refetch,
  } = usePublicMenu(!isOnePage);
  const onePage = useOnePageMenu(isOnePage);
  // One bundles list for the sheet's lookup, whichever layout is on screen.
  const menuBundles = isOnePage ? onePage.menuBundles : tabsMenuBundles;

  const { featuredSpecial } = useFeaturedSpecial();

  // The basket's totals, the slide-over's open state and the add pulse — one owner, because the
  // sticky bar's button, the floating button and the sheet all read them.
  const cart = useMenuCart();
  const orderTypeFollowUp = useOrderTypeFollowUp();
  const stickyNavOffset = useStickyNavOffset();

  // Tag the funnel event with the surface that triggered it, so a switch driven by a blocked menu
  // card is distinguishable from the sidebar toggle.
  const { pickType } = orderTypeFollowUp;
  const switchOrderTypeFromCard = useCallback((type: OrderType) => pickType(type, 'menu_card'), [pickType]);

  // One customization sheet for the whole page (menu-bundles redesign #175, slice 6): the browse
  // grid and the featured banner both open it, and it owns the selection, live pricing and the add.
  const bundlesById = useMemo(() => new Map(menuBundles.map((bundle) => [bundle.id, bundle])), [menuBundles]);
  const sheet = useCatalogSheet({ findBundle: (id) => bundlesById.get(id), onAdded: cart.flash });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Page-view event — fire ONCE on first client mount. Ref guard prevents
  // re-fire under React 19 StrictMode double-invoke in dev. Empty dep array
  // means locale switches / cart updates do not re-trigger the event.
  const menuViewedFiredRef = useRef(false);
  useEffect(() => {
    if (menuViewedFiredRef.current) return;
    menuViewedFiredRef.current = true;
    trackEvent('menu_viewed', { loggedIn: isLoggedInForAnalytics() });
  }, []);

  if (!isMounted || !selectedView) {
    return null;
  }

  const featuredSlot = featuredSpecial ? (
    <FeaturedSpecialComponent
      special={featuredSpecial}
      // The banner builds its own options (it holds the verdict); the page only routes.
      onAddToCart={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
      onViewDetails={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
      onSwitchOrderType={switchOrderTypeFromCard}
    />
  ) : undefined;

  const categoryDisplayName = getSelectedViewLabel(selectedView, categoriesForNav, t);
  // The tenant's own blurb for the selected category, when it has one. `''` on every RUMI category
  // today, so nothing renders — the field exists on `CategoryDto` and the design has a paragraph
  // there, and a tenant that fills it in gets it without another release.
  const categoryDescription = categoriesForNav.find((category) => category.id === selectedView)?.description;

  return (
    // `style` carries the sticky-nav offset the category bar reads — a computed value, which is
    // what §5.6 keeps inline styles for. See useStickyNavOffset for why it is not a constant.
    <main className={styles.menuContainer} aria-labelledby="menu-page-heading" style={stickyNavOffset}>
      <MenuPageHeader />

      <TableBanner position="top" />

      {/* The bar is PAGE CHROME and stays above the content track (D7): inside the column its
          background and hairline stopped at the column's edge — 775px of a 1280px frame — and a
          phone guest scrolled the whole promotion before the tabs appeared, then watched them jump
          when it scrolled past.

          The basket has ONE entry point on this page — the floating button below. A second copy
          lived in this bar for a while and did the same job from the other corner. */}
      {categoriesForNav.length > 0 && (
        <CategoryNav
          categories={categoriesForNav}
          /* Tabs layout: the bar swaps the view. One-page layout: the SAME bar — and the
             SAME craft surface override — jumps the page to the section instead, which is
             why the tabs (All, Menu Bundles, one per category) are unchanged up there. */
          selectedView={isOnePage ? onePage.activeSectionId : selectedView}
          onSelect={isOnePage ? onePage.selectSection : setSelectedView}
          allLabel={t('all_categories_nav')}
        />
      )}

      {/* The Chef's Special is the grid's FIRST CELL in both layouts. The page resolves the
          template SURFACE — classic one hero, craft `CraftFeaturedSpecial` — and hands the
          element down; resolving it inside a list would bundle craft into classic. */}
      {isOnePage ? (
        <MenuOnePage
          controller={onePage}
          onOpenItem={sheet.openForCatalogItem}
          onSwitchOrderType={switchOrderTypeFromCard}
          featuredFilterable={featuredSpecial ? { allergens: featuredSpecial.allergens, isSpecial: true } : undefined}
          featuredSlot={featuredSlot}
        />
      ) : (
        <div className={styles.menuLayout}>
          <MenuContent
            selectedView={selectedView}
            categoryDisplayName={categoryDisplayName}
            categoryDescription={categoryDescription}
            isLoadingItems={isLoadingItems}
            errorLoadingItems={errorLoadingItems}
            currentMenuItems={currentMenuItems}
            menuBundles={menuBundles}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onOpenItem={sheet.openForCatalogItem}
            // A card's "Switch to Takeaway" must go through the PAGE's follow-up instance: that
            // hook owns the modal state `OrderFlowModals` (below) renders from, so a card owning
            // its own instance would set the type and swallow the table/address/contact step.
            onSwitchOrderType={switchOrderTypeFromCard}
            // Retry — the copy has promised "Please try again." since before a control existed.
            onRetry={refetch}
            onBrowseFullMenu={() => setSelectedView(ALL_ITEMS_KEY)}
            showBundlesOnAllView={displaySettings.showBundlesOnAllTab}
            featuredFilterable={featuredSpecial ? { allergens: featuredSpecial.allergens, isSpecial: true } : undefined}
            featuredSlot={featuredSlot}
          />
        </div>
      )}

      <FloatingCartButton
        itemCount={cart.itemCount}
        totalPrice={cart.cartTotal}
        onAnimate={cart.pulse}
        onClick={() => cart.openSheet('mobile_sheet')}
      />

      <MenuOrderOverlays
        sheet={sheet}
        cart={cart}
        followUp={orderTypeFollowUp}
        onSwitchOrderType={switchOrderTypeFromCard}
      />
    </main>
  );
}
