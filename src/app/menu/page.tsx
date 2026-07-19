'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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

      <div className={styles.menuLayout}>
        <div className={styles.menuMain}>
          {featuredSpecial && (
            <FeaturedSpecialComponent
              special={featuredSpecial}
              onAddToCart={() => sheet.openForProductId(featuredSpecial.id)}
              onViewDetails={() => sheet.openForProductId(featuredSpecial.id)}
            />
          )}

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
          />
        </div>

        <div className={styles.menuSidebarColumn}>
          <OrderFlowSidebar followUp={orderTypeFollowUp} />
        </div>
      </div>

      <ItemCustomizationSheet controller={sheet.product} />
      <ItemCustomizationSheet controller={sheet.bundle} />

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

      <MobileCartSheet
        isOpen={isMobileCartSheetOpen}
        onClose={() => setIsMobileCartSheetOpen(false)}
        followUp={orderTypeFollowUp}
      />

      <OrderFlowModals followUp={orderTypeFollowUp} />
    </main>
  );
}
