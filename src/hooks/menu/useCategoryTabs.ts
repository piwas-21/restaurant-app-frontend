'use client';

// The ordered category tabs (All, Menu Bundles, then each API category with its
// localized display name) shared by the classic CategoryNav and the craft
// CraftCategoryNav surface — one source of truth for order, ids and labels, so
// the two navs never drift.
import { useTranslation } from 'react-i18next';
import type { ApiCategory } from '@/types/menu';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';

export interface CategoryTab {
  id: string;
  label: string;
}

export function useCategoryTabs(categories: ApiCategory[], allLabel: string): CategoryTab[] {
  const { t } = useTranslation();
  return [
    { id: ALL_ITEMS_KEY, label: allLabel },
    { id: MENU_BUNDLES_KEY, label: t('menu_bundles') },
    ...categories.map((cat) => ({ id: cat.id, label: getCategoryDisplayName(cat.name, t) })),
  ];
}
