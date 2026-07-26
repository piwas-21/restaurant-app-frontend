'use client';

import React, { useMemo } from 'react';
import DefaultMenuCard from './MenuCard';
import { surfaceOr } from '@/templates/resolve-surface';
import { toCatalogItemFromBundle, toCatalogItemFromProduct } from '@/utils/catalogItem';
import type { CatalogItem, MenuItem, MenuBundleItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import styles from './MenuContent.module.css';
import { useTranslation } from 'react-i18next';

interface MenuListProps {
  products: MenuItem[];
  bundles: MenuBundleItem[];
  /** Opens the shared customization sheet — the page owns it, so the featured banner shares it. */
  onOpenItem: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  onFeedbackSuccess: (dishId: string) => void;
  /** Card "Switch to X" — the page's `useOrderTypeFollowUp().pickType`, so the follow-up modal opens. */
  onSwitchOrderType?: (type: OrderType) => void;
}

/**
 * The customer browse grid (menu-bundles redesign #175, slice 6). One grid of one `MenuCard`, fed by
 * the `CatalogItem` mappers — replaces the products-grid / bundles-grid fork and its two card
 * components.
 */
// The active template's card override (craft) or the shared default (classic) —
// resolved at build time, so classic never bundles a craft card (T4).
const MenuCard = surfaceOr('MenuCard', DefaultMenuCard);

export default function MenuList({
  products,
  bundles,
  onOpenItem,
  onFeedbackSuccess,
  onSwitchOrderType,
}: Readonly<MenuListProps>) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.split('-')[0] || 'en';

  const items = useMemo(
    () => [...products.map(toCatalogItemFromProduct), ...bundles.map(toCatalogItemFromBundle)],
    [products, bundles],
  );

  return (
    // A real <ul>/<li>, not a div with `role="list"`/`role="listitem"`. Native semantics survive
    // where the ARIA pair does not (VoiceOver drops the roles when the container is styled
    // `display: grid`), and the roles were only ever standing in for the elements. `.itemsGrid`
    // resets the list chrome so the render is unchanged.
    <ul className={styles.itemsGrid}>
      {items.map((item) => (
        <MenuCard
          key={`${item.id}-${currentLanguage}`}
          item={item}
          onOpen={onOpenItem}
          onFeedbackSuccess={onFeedbackSuccess}
          onSwitchOrderType={onSwitchOrderType}
        />
      ))}
    </ul>
  );
}
