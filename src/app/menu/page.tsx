'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from '../styles/MenuPage.module.css';
import { useTranslation } from 'react-i18next';
import TableBanner from '@/components/TableBanner';

import { useStickyNavOffset } from '@/hooks/menu/useStickyNavOffset';
import { ALL_ITEMS_KEY, usePublicMenu } from '@/hooks/usePublicMenu';
import { useFeaturedSpecial } from '@/hooks/useFeaturedSpecial';
import { useCart } from '@/components/cart/CartContext';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import DefaultOrderFlowSidebar from '@/components/order/OrderFlowSidebar';
import MobileCartSheet from '@/components/order/MobileCartSheet';
import { surfaceOr } from '@/templates/resolve-surface';
import { getSelectedViewLabel } from '@/utils/categoryNameMapper';
import type { OrderType } from '@/types/order';

import MenuPageHeader from '@/components/menu/MenuPageHeader';
import MenuContent from '@/components/menu/MenuContent';
import DefaultCategoryNav from '@/components/menu/CategoryNav';
import DefaultFeaturedSpecial from '@/components/menu/FeaturedSpecial';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { useCatalogSheet } from '@/hooks/menu/useCatalogSheet';
import FloatingCartButton from '@/components/menu/FloatingCartButton';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

// The active template's overrides (craft = ruled-paper order pad, masking-tape tabs) or the
// shared defaults (classic) — resolved at build time, so classic never bundles craft (T4).
const OrderFlowSidebar = surfaceOr('OrderFlowSidebar', DefaultOrderFlowSidebar);
const FeaturedSpecialComponent = surfaceOr('FeaturedSpecial', DefaultFeaturedSpecial);
const CategoryNav = surfaceOr('CategoryNav', DefaultCategoryNav);

export default function MenuPage() {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [cartAnimationTrigger, setCartAnimationTrigger] = useState(false);
  const [isMobileCartSheetOpen, setIsMobileCartSheetOpen] = useState(false);

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
    onPageChange,
    refetch,
  } = usePublicMenu();

  const { featuredSpecial } = useFeaturedSpecial();

  const { state: cartState } = useCart();
  const orderTypeFollowUp = useOrderTypeFollowUp();
  const stickyNavOffset = useStickyNavOffset();

  // Tag the funnel event with the surface that triggered it, so a switch driven by a blocked menu
  // card is distinguishable from the sidebar toggle.
  const { pickType } = orderTypeFollowUp;
  const switchOrderTypeFromCard = useCallback((type: OrderType) => pickType(type, 'menu_card'), [pickType]);

  // One customization sheet for the whole page (menu-bundles redesign #175, slice 6): the browse
  // grid and the featured banner both open it, and it owns the selection, live pricing and the add.
  const bundlesById = useMemo(() => new Map(menuBundles.map((bundle) => [bundle.id, bundle])), [menuBundles]);
  const sheet = useCatalogSheet({
    findBundle: (id) => bundlesById.get(id),
    onAdded: () => {
      setCartAnimationTrigger(true);
      setTimeout(() => setCartAnimationTrigger(false), 100);
    },
  });

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

  const itemCount = cartState.items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartState.basket?.total || 0;

  return (
    // `style` carries the sticky-nav offset the category bar reads — a computed value, which is
    // what §5.6 keeps inline styles for. See useStickyNavOffset for why it is not a constant.
    <main className={styles.menuContainer} aria-labelledby="menu-page-heading" style={stickyNavOffset}>
      <MenuPageHeader />

      <TableBanner position="top" />

      {/* Both of the next two sit ABOVE the two-column layout, not inside its left column.
          The bar first (D7): inside `.menuMain` its background and hairline stopped at the left
          column's edge — 775px of a 1280px frame — and a phone guest scrolled the whole promotion
          before the tabs appeared, then watched them jump when it scrolled past. It is page chrome.
          The hero second: `.menuLayout` is a grid with `align-items: start`, so with the hero in the
          left column the basket rail's top edge aligned with the HERO and the menu grid — the thing
          a guest reads alongside their basket — began one hero-height lower. */}
      {categoriesForNav.length > 0 && (
        <CategoryNav
          categories={categoriesForNav}
          selectedView={selectedView}
          onSelect={setSelectedView}
          allLabel={t('all_categories_nav')}
        />
      )}

      {featuredSpecial && (
        <FeaturedSpecialComponent
          special={featuredSpecial}
          // The banner builds its own options (it holds the verdict); the page only routes.
          onAddToCart={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
          onViewDetails={(opts) => sheet.openForProductId(featuredSpecial.id, opts)}
          onSwitchOrderType={switchOrderTypeFromCard}
        />
      )}

      <div className={styles.menuLayout}>
        <div className={styles.menuMain}>
          <MenuContent
            selectedView={selectedView}
            categoryDisplayName={categoryDisplayName}
            isLoadingItems={isLoadingItems}
            errorLoadingItems={errorLoadingItems}
            currentMenuItems={currentMenuItems}
            menuBundles={menuBundles}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={onPageChange}
            onOpenItem={sheet.openForCatalogItem}
            // A card's "Switch to Takeaway" must go through the PAGE's follow-up instance: that
            // hook owns the modal state `OrderFlowModals` (below) renders from, so a card owning
            // its own instance would set the type and swallow the table/address/contact step.
            onSwitchOrderType={switchOrderTypeFromCard}
            // Retry — the copy has promised "Please try again." since before a control existed.
            onRetry={refetch}
            onBrowseFullMenu={() => setSelectedView(ALL_ITEMS_KEY)}
          />
        </div>

        <div className={styles.menuSidebarColumn}>
          <OrderFlowSidebar followUp={orderTypeFollowUp} />
        </div>
      </div>

      {/* Same switch handler as the cards: the sheet refuses an add the card refused (§9.10), and
          the way out has to reach the page's follow-up instance to open its modal. */}
      <ItemCustomizationSheet controller={sheet.product} onSwitchOrderType={switchOrderTypeFromCard} />
      <ItemCustomizationSheet controller={sheet.bundle} onSwitchOrderType={switchOrderTypeFromCard} />

      <FloatingCartButton
        itemCount={itemCount}
        totalPrice={cartTotal}
        onAnimate={cartAnimationTrigger}
        onClick={() => {
          // Fire once per genuine user-action click on the FAB. The sheet
          // open state is set in the same handler so this never re-fires
          // on hydration / re-render. Sidebar has no equivalent open
          // event because it's always-mounted on desktop.
          trackEvent('cart_opened', {
            source: 'mobile_sheet',
            itemCount,
            loggedIn: isLoggedInForAnalytics(),
          });
          setIsMobileCartSheetOpen(true);
        }}
      />

      {/* Closed while an order-type conflict is being confirmed. The sheet hosts the very toggle
          that raises the confirm, so leaving it open stacks two BaseModals — and both register a
          GLOBAL window keydown, so one Escape dismisses both. Same rule §9.10 landed for the
          customization sheet: the surface that hands a verdict over closes behind it. */}
      <MobileCartSheet
        isOpen={isMobileCartSheetOpen && orderTypeFollowUp.switchFlow.pending === null}
        onClose={() => setIsMobileCartSheetOpen(false)}
        followUp={orderTypeFollowUp}
      />

      <OrderFlowModals followUp={orderTypeFollowUp} />
    </main>
  );
}
