
"use client";

import React from "react";
import MenuItem from "./MenuItem";
import type { MenuItem as MenuItemType } from "@/types/menu";
import styles from "@/app/styles/MenuPage.module.css";

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
  return (
    <div className={styles.itemsGrid} role="list">
      {items.map((item) => (
        <MenuItem
          key={item.id}
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
