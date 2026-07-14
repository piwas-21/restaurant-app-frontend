'use client';

import React from 'react';
import MenuCard from './MenuCard';
import ItemCustomizationSheet from './ItemCustomizationSheet';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import type { MenuItem as MenuItemType } from '@/types/menu';
import styles from './MenuContent.module.css';
import { useTranslation } from 'react-i18next';

interface MenuListProps {
  items: MenuItemType[];
  onFeedbackSuccess: (dishId: string) => void;
  getFallbackImage: (item: MenuItemType) => void;
}

const MenuList: React.FC<MenuListProps> = ({ items, onFeedbackSuccess, getFallbackImage }) => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.split('-')[0] || 'en';
  const sheet = useItemCustomizationSheet();

  return (
    <>
      <div className={styles.itemsGrid} role="list">
        {items.map((item) => (
          <MenuCard
            key={`${item.id}-${currentLanguage}`}
            item={item}
            onAdd={sheet.openForProduct}
            onFeedbackSuccess={onFeedbackSuccess}
            getFallbackImage={getFallbackImage}
          />
        ))}
      </div>
      <ItemCustomizationSheet controller={sheet} />
    </>
  );
};

export default MenuList;
