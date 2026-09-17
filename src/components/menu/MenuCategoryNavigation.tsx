'use client';

import type { ApiCategory } from '@/types/menu';
import CategoryNav from './CategoryNav';
import { surfaceOr } from '@/templates/resolve-surface';

const CategoryNavigationSurface = surfaceOr('CategoryNav', CategoryNav);

interface MenuCategoryNavigationProps {
  categories: ApiCategory[];
  isOnePage: boolean;
  activeSectionId: string;
  selectedView: string;
  onSelectSection: (view: string) => void;
  onSelectView: (view: string) => void;
  allLabel: string;
  hideBundles: boolean;
}

/** Shared category bar for tabs and one-page modes, including the grouped-family tab suppression. */
export default function MenuCategoryNavigation({
  categories,
  isOnePage,
  activeSectionId,
  selectedView,
  onSelectSection,
  onSelectView,
  allLabel,
  hideBundles,
}: Readonly<MenuCategoryNavigationProps>) {
  if (categories.length === 0) return null;

  return (
    <CategoryNavigationSurface
      categories={categories}
      selectedView={isOnePage ? activeSectionId : selectedView}
      onSelect={isOnePage ? onSelectSection : onSelectView}
      allLabel={allLabel}
      hideBundles={hideBundles}
    />
  );
}
