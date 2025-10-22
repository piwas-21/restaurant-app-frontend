
"use client";

import React from "react";
import MenuItem from "./MenuItem";
import type { MenuItem as MenuItemType } from "@/types/menu";
import styles from "@/app/styles/MenuPage.module.css";
import { useTranslation } from "react-i18next";

interface MenuListProps {
  items: MenuItemType[];
  onImageClick: (item: MenuItemType, imageIndex?: number) => void;
  onFeedbackSuccess: (dishId: string) => void;
  getFallbackImage: (item: MenuItemType) => void;
}

const MenuList: React.FC<MenuListProps> = ({
  items,
  onImageClick,
  onFeedbackSuccess,
  getFallbackImage,
}) => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.split("-")[0] || "en";

  return (
    <div className={styles.itemsGrid} role="list">
      {items.map((item) => (
        <MenuItem
          key={`${item.id}-${currentLanguage}`}
          item={item}
          onImageClick={onImageClick}
          onFeedbackSuccess={onFeedbackSuccess}
          getFallbackImage={getFallbackImage}
        />
      ))}
    </div>
  );
};

export default MenuList;
