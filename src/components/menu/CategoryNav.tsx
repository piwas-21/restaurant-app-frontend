"use client";

import React from "react";
import styles from "@/app/styles/MenuPage.module.css";
import type { ApiCategory } from "@/types/menu";

type Props = {
  categories: ApiCategory[];
  selectedView: string | typeof ALL_ITEMS_KEY;
  onSelect: (value: string | typeof ALL_ITEMS_KEY) => void;
  allLabel: string;
};

export const ALL_ITEMS_KEY = "all" as const;

export default function CategoryNav({ categories, selectedView, onSelect, allLabel }: Props) {
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
          {cat.name}
        </button>
      ))}
    </nav>
  );
}

