"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import styles from "@/app/styles/MenuPage.module.css";
import type { ApiCategory } from "@/types/menu";

type Props = {
  categories: ApiCategory[];
  selectedView: string | typeof ALL_ITEMS_KEY;
  onSelect: (value: string | typeof ALL_ITEMS_KEY) => void;
  allLabel: string;
};

export const ALL_ITEMS_KEY = "all" as const;

// Map API category names to translation keys
function mapCategoryNameToTranslationKey(apiCategoryName: string): string {
  const mapping: { [key: string]: string } = {
    'Starters': 'starters',
    'Grills': 'grill',
    'Grill': 'grill',
    'Dessert': 'dessert',
    'Desserts': 'dessert',
    'Dürüm Wraps': 'durum',
    'Durum Wraps': 'durum',
    'Hot Drinks': 'hotDrink',
    'Cold Drinks': 'coldDrink',
    'Drinks': 'hotDrink', // Default to hot drinks, might need more logic
    'Pizza': 'pizza',
    'Pide': 'pide',
    'Turkish Specialties': 'turkishSpecialty',
    'Oriental Specialties': 'orientalSpecialty',
    'Special of the Day': 'specialOfTheDay',
    'Soups': 'soups'
  };

  return mapping[apiCategoryName] || apiCategoryName.toLowerCase();
}

export default function CategoryNav({ categories, selectedView, onSelect, allLabel }: Props) {
  const { t } = useTranslation();

  const getCategoryDisplayName = (categoryName: string) => {
    const translationKey = mapCategoryNameToTranslationKey(categoryName);
    const translatedName = t(translationKey);

    // If translation exists and is different from the key, use it; otherwise use API name
    return translatedName !== translationKey ? translatedName : categoryName;
  };

  return (
    <nav className={styles.stickyNav} aria-label="Category Navigation">
      <button
        key={ALL_ITEMS_KEY}
        className={`${styles.navButton} ${selectedView === ALL_ITEMS_KEY ? styles.navButtonActive : ""}`}
        onClick={() => onSelect(ALL_ITEMS_KEY)}
        aria-pressed={selectedView === ALL_ITEMS_KEY}
      >
        {allLabel}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`${styles.navButton} ${selectedView === cat.id ? styles.navButtonActive : ""}`}
          onClick={() => onSelect(cat.id)}
          aria-pressed={selectedView === cat.id}
        >
          {getCategoryDisplayName(cat.name)}
        </button>
      ))}
    </nav>
  );
}

