'use client';

import { useEffect, useRef, useState } from 'react';
import { getAllProducts } from '@/services/menuService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import type { Product } from '@/app/admin/menu-management/interfaces';

interface LinkExistingMenuLoaderOptions {
  readonly isOpen: boolean;
  readonly productId: string;
  /** Mirrors the backend parent-side rules: components and linked menus cannot anchor families. */
  readonly parentEligible?: boolean;
}

const parentId = (menu: Product): string | null => menu.parentOfferProductId ?? null;

/**
 * Loads only bundles that the backend relationship rules can accept as the child side of a link.
 * Component rows are option-only, and a menu that already anchors an alternative would create a
 * chain. Both are filtered here so the modal cannot offer an action that the API must reject.
 */
export function useLinkExistingMenuLoader({ isOpen, productId, parentEligible = true }: LinkExistingMenuLoaderOptions) {
  const [bundles, setBundles] = useState<Product[]>([]);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen || !parentEligible || !productId) {
      abortRef.current?.abort();
      setBundles([]);
      setParentNames({});
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequence.current;
    setBundles([]);
    setParentNames({});
    setLoadError(null);
    setIsLoading(true);

    void getAllProducts(null, { includeMenus: true, includeComponents: true }, controller.signal)
      .then((items) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setParentNames(Object.fromEntries(items.map((item) => [item.id, item.name])));
        const anchoringMenuIds = new Set(items.map((item) => parentId(item)).filter((id): id is string => id !== null));
        setBundles(
          items.filter(
            (bundle) =>
              isMenuBundle(bundle) &&
              !bundle.isComponent &&
              bundle.id !== productId &&
              parentId(bundle) !== productId &&
              !anchoringMenuIds.has(bundle.id),
          ),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setLoadError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setIsLoading(false);
      });

    return () => {
      requestSequence.current += 1;
      controller.abort();
    };
  }, [isOpen, parentEligible, productId]);

  return { bundles, parentNames, isLoading, loadError };
}
