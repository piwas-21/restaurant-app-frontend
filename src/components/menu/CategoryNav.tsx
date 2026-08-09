'use client';

import styles from './CategoryNav.module.css';
import type { ApiCategory } from '@/types/menu';
import { useCategoryNavScroll } from '@/hooks/menu/useCategoryNavScroll';
import { useCategoryTabs } from '@/hooks/menu/useCategoryTabs';
import CategoryNavShell from './CategoryNavShell';

export interface CategoryNavProps {
  categories: ApiCategory[];
  /**
   * The selected view: an API category id, or one of the `ALL_ITEMS_KEY` /
   * `MENU_BUNDLES_KEY` sentinels — all strings (see `publicMenu/constants`,
   * `PublicMenuView`). Typed `string` because those literals are subsumed by it.
   */
  selectedView: string;
  onSelect: (value: string) => void;
  allLabel: string;
}

export default function CategoryNav({ categories, selectedView, onSelect, allLabel }: Readonly<CategoryNavProps>) {
  const tabs = useCategoryTabs(categories, allLabel);
  const nav = useCategoryNavScroll(categories.length);

  // Underline-indicated tabs (classic); the sticky bar + scroll arrows live in the shared shell.
  // No arrow gate is passed on purpose. `useCategoryNavScroll` already measures whether there is
  // anything to scroll to, which is exactly what Prompt 6 asks the arrows to express ("appearing
  // only when there is more to scroll"). The `tabs.length > 5` that used to sit here was a COUNT:
  // with `All` and `Menu Bundles` always prepended it meant "4+ tenant categories", so a bar that
  // overflowed on three could not show an arrow and a bar that fit on six showed two.
  return (
    <CategoryNavShell styles={styles} {...nav}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.navButton} ${selectedView === tab.id ? styles.navButtonActive : ''}`}
          onClick={() => onSelect(tab.id)}
          aria-pressed={selectedView === tab.id}
        >
          {/* Wrapped rather than `dir` on the button: with a notice the button has an element
              child, and §8.2 keeps `dir="auto"` on leaves. Category names are tenant-authored. */}
          <span dir="auto">{tab.label}</span>
          {/* Inside the button on purpose: the reason becomes part of the tab's accessible name, so
              a restricted category announces WHY, the same way a dimmed card does. */}
          {tab.notice && <span className={styles.navButtonNotice}>{tab.notice.message}</span>}
        </button>
      ))}
    </CategoryNavShell>
  );
}
