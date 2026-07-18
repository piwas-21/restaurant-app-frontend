'use client';

import styles from './CategoryNav.module.css';
import type { ApiCategory } from '@/types/menu';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import { useCategoryNavScroll } from '@/hooks/menu/useCategoryNavScroll';
import { useCategoryTabs } from '@/hooks/menu/useCategoryTabs';
import CategoryNavShell from './CategoryNavShell';

export type CategoryNavSelection = string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY;

export interface CategoryNavProps {
  categories: ApiCategory[];
  selectedView: CategoryNavSelection;
  onSelect: (value: CategoryNavSelection) => void;
  allLabel: string;
}

export default function CategoryNav({ categories, selectedView, onSelect, allLabel }: Readonly<CategoryNavProps>) {
  const tabs = useCategoryTabs(categories, allLabel);
  const nav = useCategoryNavScroll(categories.length);

  // Rounded-pill tabs (classic); the sticky bar + scroll arrows live in the shared shell.
  return (
    <CategoryNavShell styles={styles} showNavArrows={tabs.length > 5} {...nav}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.navButton} ${selectedView === tab.id ? styles.navButtonActive : ''}`}
          onClick={() => onSelect(tab.id)}
          aria-pressed={selectedView === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </CategoryNavShell>
  );
}
