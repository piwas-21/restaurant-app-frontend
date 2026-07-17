'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { emptyProductDetails } from '@/utils/productEditorDefaults';
import ProductEditorPage from '@/components/admin/product-editor/ProductEditorPage';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';

const LIST_ROUTE = '/admin/menu-management';

/**
 * The create route (menu-bundles redesign #176, slice 7 PR2e). Static `new` segment, so it
 * wins over the sibling `[productId]` dynamic route. The type is chosen once at the list's
 * "New product" picker and passed as `?type=` — it is fixed here because the backend has no
 * item↔bundle migration (a bundle needs a MenuDefinition), so the kind can't change after.
 *
 * It reuses the SAME editor page as edit; only the mode differs — an empty product, the
 * create schema, and a POST instead of a PUT.
 */
const NewProductRoute = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBundle = isMenuBundle({ type: searchParams.get('type') });

  // Memoised so a re-render does not mint a fresh object and re-run the form's reset effect,
  // which would wipe whatever the admin has typed.
  const blankProduct = useMemo(() => emptyProductDetails(isBundle), [isBundle]);

  return (
    <ProductEditorPage
      product={blankProduct}
      isBundle={isBundle}
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
