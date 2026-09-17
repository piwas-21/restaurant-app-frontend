import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/** Preserve product placement fields when the MenuBundleDto omits its category projection. */
export function normalizeMenuBundleProduct(base: ProductDetails, bundle: ProductDetails): ProductDetails {
  return {
    ...base,
    ...bundle,
    type: 'menu',
    categories: Array.isArray(bundle.categories) && bundle.categories.length > 0 ? bundle.categories : base.categories,
    primaryCategory: bundle.primaryCategory ?? base.primaryCategory,
  };
}
