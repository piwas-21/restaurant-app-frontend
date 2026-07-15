'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/MenuPage.module.css';
import { useTranslation } from 'react-i18next';
import TableBanner from '@/components/TableBanner';

import type { LanguageCode } from '@/components/LanguageSwitcher';
import { usePublicMenu, ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import { useFeaturedSpecial } from '@/hooks/useFeaturedSpecial';
import { useCart } from '@/components/cart/CartContext';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import OrderFlowSidebar from '@/components/order/OrderFlowSidebar';
import MobileCartSheet from '@/components/order/MobileCartSheet';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import { setFallbackImage } from '@/utils/imageHelpers';

import MenuPageHeader from '@/components/menu/MenuPageHeader';
import MenuContent from '@/components/menu/MenuContent';
import MenuModals from '@/components/menu/MenuModals';
import FeaturedSpecialComponent from '@/components/menu/FeaturedSpecial';
import MenuBundleDetailsModal from '@/components/menu/MenuBundleDetailsModal';
import { MenuBundleItem } from '@/types/menu';
import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import FloatingCartButton from '@/components/menu/FloatingCartButton';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

export default function MenuPage() {
  const { t, i18n } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<MenuBundleItem | null>(null);
  const [showBundleDetails, setShowBundleDetails] = useState(false);
  const [cartAnimationTrigger, setCartAnimationTrigger] = useState(false);
  const [isMobileCartSheetOpen, setIsMobileCartSheetOpen] = useState(false);

  const currentLanguage = (i18n.language.split('-')[0] || 'en') as LanguageCode;

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

  const {
    featuredSpecial,
    showFeaturedDetails,
    showFeaturedCustomization,
    handleAddFeaturedToCart,
    handleFeaturedCustomizationConfirm,
    handleViewFeaturedDetails,
    handleCloseFeaturedDetails,
    setShowFeaturedCustomization,
  } = useFeaturedSpecial();

  const { state: cartState } = useCart();
  const orderTypeFollowUp = useOrderTypeFollowUp();

  // The unified customization sheet drives the bundle add flow (menu-bundles redesign #175,
  // slice 6) — it owns the section selection, live pricing and the add itself.
  const bundleSheet = useBundleCustomizationSheet({
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

  const handleViewBundleDetails = (bundle: MenuBundleItem) => {
    setSelectedBundle(bundle);
    setShowBundleDetails(true);
  };

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
              onAddToCart={handleAddFeaturedToCart}
              onViewDetails={handleViewFeaturedDetails}
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
            getFallbackImage={setFallbackImage}
            currentLanguage={currentLanguage}
            onAddBundleToCart={bundleSheet.openForBundle}
            onViewBundleDetails={handleViewBundleDetails}
          />
        </div>

        <div className={styles.menuSidebarColumn}>
          <OrderFlowSidebar followUp={orderTypeFollowUp} />
        </div>
      </div>

      <MenuModals
        featuredSpecial={featuredSpecial}
        showFeaturedDetails={showFeaturedDetails}
        showFeaturedCustomization={showFeaturedCustomization}
        onCloseFeaturedDetails={handleCloseFeaturedDetails}
        onCloseFeaturedCustomization={() => setShowFeaturedCustomization(false)}
        onFeaturedCustomizationConfirm={handleFeaturedCustomizationConfirm}
      />

      {/* Menu Bundle Details Modal */}
      <MenuBundleDetailsModal
        bundle={selectedBundle}
        isOpen={showBundleDetails}
        onClose={() => setShowBundleDetails(false)}
        onAddToCart={bundleSheet.openForBundle}
        currentLanguage={currentLanguage}
      />

      <ItemCustomizationSheet controller={bundleSheet} />

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
