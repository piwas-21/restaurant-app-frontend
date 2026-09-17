'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { emptyProductDetails } from '@/utils/productEditorDefaults';
import ProductEditorPage from '@/components/admin/product-editor/ProductEditorPage';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { consumeMenuVersionPrefill, productFromMenuVersionPrefill } from '@/utils/menuVersionPrefill';

const LIST_ROUTE = '/admin/menu-management';
/** Where an item-create request goes now: the list, with the quick-add modal already open. */
const QUICK_ADD_ROUTE = `${LIST_ROUTE}?new=item`;

/**
 * The BUNDLE create route (menu-bundles redesign #176, slice 7 PR2e; narrowed to bundles by
 * MENU-ITEM-EDITOR-REDESIGN-PLAN slice S3). Static `new` segment, so it wins over the sibling
 * `[productId]` dynamic route. The type is chosen once at the list's "New product" picker and
 * passed as `?type=` — it is fixed here because the backend has no item↔bundle migration (a bundle
 * needs a MenuDefinition), so the kind can't change after.
 *
 * **An ITEM no longer has a create page** (decision D3). Creating one is a quick-add modal on the
 * list — name, price, category — because everything else on this screen needs a saved product to
 * attach to, photos most of all. So this route serves bundles and redirects everything else to the
 * modal rather than 404-ing a URL an admin may have bookmarked. A bundle keeps its page: its
 * sections editor IS the screen, and there is no three-field version of it.
 */
const NewProductRoute = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBundle = isMenuBundle({ type: searchParams.get('type') });
  const hasOfferPrefill = searchParams.get('prefill') === 'offer';
  const blankProduct = useMemo(() => emptyProductDetails(true), []);
  const [initialProduct, setInitialProduct] = useState<ProductDetails | null>(null);
  const prefillConsumed = useRef(false);

  useEffect(() => {
    if (!isBundle) router.replace(QUICK_ADD_ROUTE);
  }, [isBundle, router]);

  useEffect(() => {
    // Effects are replayed in React Strict Mode. The session value is intentionally one-shot, so
    // guard consumption or the replay would turn a valid quick-create prefill into a blank editor.
    if (hasOfferPrefill && !prefillConsumed.current) {
      prefillConsumed.current = true;
      const prefill = consumeMenuVersionPrefill();
      setInitialProduct(prefill ? productFromMenuVersionPrefill(prefill) : blankProduct);
      return;
    }
    if (!hasOfferPrefill) setInitialProduct(blankProduct);
  }, [blankProduct, hasOfferPrefill]);

  if (!isBundle || !initialProduct) return null;

  return (
    <ProductEditorPage
      product={initialProduct}
      isBundle
      mode="create"
      onSaved={() => router.push(LIST_ROUTE)}
      onBack={() => router.push(LIST_ROUTE)}
    />
  );
};

const NewProductRoutePage = () => (
  <AdminAuthGuard>
    <Suspense fallback={<div>Loading...</div>}>
      <NewProductRoute />
    </Suspense>
  </AdminAuthGuard>
);

export default NewProductRoutePage;
