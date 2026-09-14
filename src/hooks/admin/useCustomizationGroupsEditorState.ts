'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { ProductCustomizationGroupDraft } from '@/types/menu';

export function useCustomizationGroupsEditorState(product: ProductDetails, isBundle: boolean) {
  const [groups, setGroups] = useState<ProductCustomizationGroupDraft[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setGroups(isBundle ? [] : (product.customizationGroups ?? []));
    setIsDirty(false);
  }, [product, isBundle]);

  const change = useCallback((next: ProductCustomizationGroupDraft[]) => {
    setGroups(next);
    setIsDirty(true);
  }, []);
  const markClean = useCallback(() => setIsDirty(false), []);

  return { groups, change, isDirty, markClean };
}
