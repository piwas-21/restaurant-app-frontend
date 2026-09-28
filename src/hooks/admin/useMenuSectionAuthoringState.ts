'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition, MenuSection } from '@/types/menu';
import type { MenuSectionsPatchResult } from '@/services/menuBundleService';
import { toMenuDefinitionState } from '@/utils/productEditorDefaults';

/** Keep the latest server baseline separate from the editable menu draft. */
export function useMenuSectionAuthoringState(product: ProductDetails) {
  const [menuDefinition, setMenuDefinition] = useState<MenuDefinition>(() => toMenuDefinitionState(product));
  const persistedMenuDefinition = useRef(menuDefinition);

  useEffect(() => {
    const next = toMenuDefinitionState(product);
    persistedMenuDefinition.current = next;
    setMenuDefinition(next);
  }, [product]);

  const onMenuSectionsPatched = useCallback((result: MenuSectionsPatchResult, draftSections: MenuSection[]) => {
    persistedMenuDefinition.current = {
      ...persistedMenuDefinition.current,
      authoringVersion: result.authoringVersion,
      sections: result.sections,
    };
    setMenuDefinition((current) => ({
      ...current,
      authoringVersion: result.authoringVersion,
      sections: draftSections,
    }));
  }, []);

  const productForSave = product.menuDefinition
    ? {
        ...product,
        menuDefinition: {
          ...product.menuDefinition,
          authoringVersion: persistedMenuDefinition.current.authoringVersion,
          sections: persistedMenuDefinition.current.sections,
        },
      }
    : product;

  return { menuDefinition, setMenuDefinition, onMenuSectionsPatched, productForSave };
}
