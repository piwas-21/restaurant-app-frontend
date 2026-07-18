'use client';

// Craft's menu category nav (S15 T4 surface slot): masking-tape tabs — a torn
// kraft strip per category tilted at slightly different hand-placed angles
// (Caveat), the active one terracotta. Same behaviour as the shared CategoryNav
// (order, ids, labels, the horizontal-scroll shell) via the shared hooks +
// CategoryNavShell; only the tab buttons differ. Rendered only in the craft
// build (resolved via surfaceOr).
import type { CSSProperties } from 'react';
import type { CategoryNavProps } from '@/components/menu/CategoryNav';
import CategoryNavShell from '@/components/menu/CategoryNavShell';
import { useCategoryNavScroll } from '@/hooks/menu/useCategoryNavScroll';
import { useCategoryTabs } from '@/hooks/menu/useCategoryTabs';
import styles from './CraftCategoryNav.module.css';

// Hand-placed tilts, cycled per tab so the tape strips look stuck on by hand.
// A per-tab CSS custom property (a dynamic computed value — CLAUDE.md §5.6) so
// the CSS can compose the tilt with the hover-lift; no raw colours inline.
const TILTS = ['-2deg', '1.5deg', '-0.75deg', '2deg', '-1.25deg'];

export default function CraftCategoryNav({ categories, selectedView, onSelect, allLabel }: Readonly<CategoryNavProps>) {
  const tabs = useCategoryTabs(categories, allLabel);
  const nav = useCategoryNavScroll(categories.length);

  return (
    <CategoryNavShell styles={styles} showNavArrows={tabs.length > 5} {...nav}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${selectedView === tab.id ? styles.tabActive : ''}`}
          style={{ '--tab-tilt': TILTS[index % TILTS.length] } as CSSProperties}
          onClick={() => onSelect(tab.id)}
          aria-pressed={selectedView === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </CategoryNavShell>
  );
}
