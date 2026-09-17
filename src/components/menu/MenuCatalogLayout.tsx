'use client';

import type { ReactNode } from 'react';
import type { CatalogOfferFamily } from '@/types/menu';
import type { UsePublicOfferFamiliesReturn } from '@/hooks/usePublicOfferFamilies';
import type { UseOnePageMenuReturn } from '@/hooks/useOnePageMenu';
import MenuContent, { type MenuContentProps } from './MenuContent';
import MenuOnePage from './MenuOnePage';
import styles from '@/styles/MenuPage.module.css';

interface MenuCatalogLayoutProps {
  isOnePage: boolean;
  onePage: UseOnePageMenuReturn;
  menuContentProps: MenuContentProps;
  onOpenItem: MenuContentProps['onOpenItem'];
  onSwitchOrderType?: MenuContentProps['onSwitchOrderType'];
  featuredSlot?: ReactNode;
  featuredFilterable?: MenuContentProps['featuredFilterable'];
  offerFamilies?: CatalogOfferFamily[];
  offerFamiliesState?: UsePublicOfferFamiliesReturn;
}

/** Chooses the legacy tabs body or the one-page body after the page has loaded its controllers. */
export default function MenuCatalogLayout({
  isOnePage,
  onePage,
  menuContentProps,
  onOpenItem,
  onSwitchOrderType,
  featuredSlot,
  featuredFilterable,
  offerFamilies,
  offerFamiliesState,
}: Readonly<MenuCatalogLayoutProps>) {
  if (isOnePage) {
    return (
      <MenuOnePage
        controller={onePage}
        onOpenItem={onOpenItem}
        onSwitchOrderType={onSwitchOrderType}
        featuredFilterable={featuredFilterable}
        featuredSlot={featuredSlot}
        offerFamilies={offerFamilies}
        offerFamiliesState={offerFamiliesState}
      />
    );
  }

  return (
    <div className={styles.menuLayout}>
      <MenuContent {...menuContentProps} />
    </div>
  );
}
