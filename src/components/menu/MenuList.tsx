'use client';

import React, { useMemo } from 'react';
import MenuCard from './MenuCard';
import { toCatalogItemFromBundle, toCatalogItemFromProduct } from '@/utils/catalogItem';
import type { CatalogItem, MenuItem, MenuBundleItem } from '@/types/menu';
import styles from './MenuContent.module.css';
import { useTranslation } from 'react-i18next';

interface MenuListProps {
  products: MenuItem[];
  bundles: MenuBundleItem[];
  /** Opens the shared customization sheet — the page owns it, so the featured banner shares it. */
  onOpenItem: (item: CatalogItem) => void;
  onFeedbackSuccess: (dishId: string) => void;
}

/**
 * The customer browse grid (menu-bundles redesign #175, slice 6). One grid of one `MenuCard`, fed by
 * the `CatalogItem` mappers — replaces the products-grid / bundles-grid fork and its two card
 * components.
 */
export default function MenuList({ products, bundles, onOpenItem, onFeedbackSuccess }: Readonly<MenuListProps>) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.split('-')[0] || 'en';

  const items = useMemo(
    () => [...products.map(toCatalogItemFromProduct), ...bundles.map(toCatalogItemFromBundle)],
    [products, bundles],
  );

  return (
    <div className={styles.itemsGrid} role="list">
      {items.map((item) => (
        <MenuCard
          key={`${item.id}-${currentLanguage}`}
          item={item}
          onOpen={onOpenItem}
          onFeedbackSuccess={onFeedbackSuccess}
        />
      ))}
    </div>
  );
}
