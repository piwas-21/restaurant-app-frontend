'use client';

import { useEffect, useRef, useState } from 'react';
import { getAllProducts } from '@/services/menuService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import type { Product } from '@/app/admin/menu-management/interfaces';

interface LinkExistingMenuLoaderOptions {
  readonly isOpen: boolean;
  readonly productId: string;
}

const parentId = (menu: Product): string | null => menu.parentOfferProductId ?? null;

/** Loads only linkable bundles and ignores responses from a closed or superseded modal. */
export function useLinkExistingMenuLoader({ isOpen, productId }: LinkExistingMenuLoaderOptions) {
  const [bundles, setBundles] = useState<Product[]>([]);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
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
        setBundles(
          items.filter((bundle) => isMenuBundle(bundle) && bundle.id !== productId && parentId(bundle) !== productId),
        );
      })
      .catch((caught) => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setLoadError(caught);
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setIsLoading(false);
      });

    return () => {
      requestSequence.current += 1;
      controller.abort();
    };
  }, [isOpen, productId]);

  return { bundles, parentNames, isLoading, loadError };
}
