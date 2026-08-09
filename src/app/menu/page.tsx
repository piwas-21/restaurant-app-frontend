'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from '../styles/MenuPage.module.css';
import { useTranslation } from 'react-i18next';
import TableBanner from '@/components/TableBanner';

import { useStickyNavOffset } from '@/hooks/menu/useStickyNavOffset';
import { ALL_ITEMS_KEY, usePublicMenu } from '@/hooks/usePublicMenu';
import { useFeaturedSpecial } from '@/hooks/useFeaturedSpecial';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import CartSheet from '@/components/order/CartSheet';
import { surfaceOr } from '@/templates/resolve-surface';
import { getSelectedViewLabel } from '@/utils/categoryNameMapper';
import type { OrderType } from '@/types/order';

import MenuPageHeader from '@/components/menu/MenuPageHeader';
import MenuContent from '@/components/menu/MenuContent';
import DefaultCategoryNav from '@/components/menu/CategoryNav';
import DefaultFeaturedSpecial from '@/components/menu/FeaturedSpecial';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { useCatalogSheet } from '@/hooks/menu/useCatalogSheet';
import { useMenuCart } from '@/hooks/menu/useMenuCart';
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

  const {
    categories: categoriesForNav,
    selectedView,
    setSelectedView,
    items: currentMenuItems,
    menuBundles,
    isLoading: isLoadingItems,
    error: errorLoadingItems,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    refetch,
  } = usePublicMenu();

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
          selectedView={selectedView}
          onSelect={setSelectedView}
          allLabel={t('all_categories_nav')}
        />
      )}

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
          // The Chef's Special is the grid's FIRST CELL now, spanning two columns, which is where
          // the design puts it. The page still resolves the template SURFACE — classic ships one
          // hero, craft ships `CraftFeaturedSpecial` — and hands the element down; `MenuList` only
          // decides where it sits. Resolving it inside the list would bundle craft into classic.
          // The data behind the slot, so `MenuContent` can filter the special by the same rule as
          // the grid rather than hiding it whenever any chip is on.
          featuredFilterable={featuredSpecial ? { allergens: featuredSpecial.allergens, isSpecial: true } : undefined}
          featuredSlot={
            featuredSpecial ? (
              <FeaturedSpecialComponent
                special={featuredSpecial}
                // The banner builds its own options (it holds the verdict); the page only routes.
                onAddToCart={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
                onViewDetails={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
                onSwitchOrderType={switchOrderTypeFromCard}
              />
            ) : undefined
          }
        />
      </div>

      {/* Same switch handler as the cards: the sheet refuses an add the card refused (§9.10), and
          the way out has to reach the page's follow-up instance to open its modal. */}
      <ItemCustomizationSheet controller={sheet.product} onSwitchOrderType={switchOrderTypeFromCard} />
      <ItemCustomizationSheet controller={sheet.bundle} onSwitchOrderType={switchOrderTypeFromCard} />

      <FloatingCartButton
        itemCount={cart.itemCount}
        totalPrice={cart.cartTotal}
        onAnimate={cart.pulse}
        onClick={() => cart.openSheet('mobile_sheet')}
      />

      {/* Closed while an order-type conflict is being confirmed. The sheet hosts the very toggle
          that raises the confirm, so leaving it open stacks two BaseModals — and both register a
          GLOBAL window keydown, so one Escape dismisses both. Same rule §9.10 landed for the
          customization sheet: the surface that hands a verdict over closes behind it. */}
      <CartSheet
        isOpen={cart.isSheetOpen && orderTypeFollowUp.switchFlow.pending === null}
        onClose={cart.closeSheet}
        followUp={orderTypeFollowUp}
      />

      <OrderFlowModals followUp={orderTypeFollowUp} />
    </main>
  );
}
