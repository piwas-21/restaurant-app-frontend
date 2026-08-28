'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { emptyProductDetails } from '@/utils/productEditorDefaults';
import ProductEditorPage from '@/components/admin/product-editor/ProductEditorPage';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';

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

  useEffect(() => {
    if (!isBundle) router.replace(QUICK_ADD_ROUTE);
  }, [isBundle, router]);

  // Memoised so a re-render does not mint a fresh object and re-run the form's reset effect,
  // which would wipe whatever the admin has typed.
  const blankProduct = useMemo(() => emptyProductDetails(true), []);

  if (!isBundle) return null;

  return (
    <ProductEditorPage
      product={blankProduct}
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
