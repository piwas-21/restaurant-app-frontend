'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from '../styles/MenuPage.module.css';
import { useTranslation } from 'react-i18next';
import TableBanner from '@/components/TableBanner';

import { usePublicMenu, ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import { useFeaturedSpecial } from '@/hooks/useFeaturedSpecial';
import { useCart } from '@/components/cart/CartContext';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import DefaultOrderFlowSidebar from '@/components/order/OrderFlowSidebar';
import MobileCartSheet from '@/components/order/MobileCartSheet';
import { surfaceOr } from '@/templates/resolve-surface';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import type { OrderType } from '@/types/order';

import MenuPageHeader from '@/components/menu/MenuPageHeader';
import MenuContent from '@/components/menu/MenuContent';
import FeaturedSpecialComponent from '@/components/menu/FeaturedSpecial';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { useCatalogSheet } from '@/hooks/menu/useCatalogSheet';
import FloatingCartButton from '@/components/menu/FloatingCartButton';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

// The active template's cart-rail override (craft = ruled-paper order pad) or the
// shared default (classic) — resolved at build time, so classic never bundles
// craft (T4).
const OrderFlowSidebar = surfaceOr('OrderFlowSidebar', DefaultOrderFlowSidebar);

export default function MenuPage() {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [cartAnimationTrigger, setCartAnimationTrigger] = useState(false);
  const [isMobileCartSheetOpen, setIsMobileCartSheetOpen] = useState(false);

  // Custom hooks
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
  } = usePublicMenu();

  const { featuredSpecial } = useFeaturedSpecial();

  const { state: cartState } = useCart();
  const orderTypeFollowUp = useOrderTypeFollowUp();

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

  // Get display name for selected category
  const categoryDisplayName =
    selectedView === ALL_ITEMS_KEY
      ? t('all_categories_nav')
      : selectedView === MENU_BUNDLES_KEY
        ? t('menu_bundles')
        : (() => {
            const category = categoriesForNav.find((c) => c.id === selectedView);
            if (!category) return String(selectedView);
            return getCategoryDisplayName(category.name, t);
          })();

  // Calculate cart totals for floating button
  const itemCount = cartState.items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartState.basket?.total || 0;

  return (
    <main className={styles.menuContainer} aria-labelledby="menu-page-heading">
      <MenuPageHeader />

      <TableBanner position="top" />

      {/* ABOVE the two-column layout, not inside its left column.
          `.menuLayout` is a grid with `align-items: start`, so the basket rail's top edge aligns
          with whatever starts the left column. With the banner in there, the rail lined up with the
          BANNER and the menu grid — the thing a guest reads alongside their basket — began one
          banner-height lower. Nothing was misaligned by accident; the hero was simply inside the
          column it should sit above. Moving it also gives it the full width a hero wants. */}
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
            categoriesForNav={categoriesForNav}
            selectedView={selectedView}
            onSelectView={setSelectedView}
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

      {/* Floating Cart Button */}
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
