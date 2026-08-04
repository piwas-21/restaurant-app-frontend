'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProductById } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { serverMessages } from '@/utils/apiFormErrors';
import { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * Fetch one product for the editor route, deriving its kind rather than trusting a URL hint, and
 * turn every way that can fail into a sentence the admin can act on.
 *
 * Extracted from the route (E9 slice 8) because the page hit the §4 200-LOC limit once the two
 * refusal paths needed explaining — and they did need it, because the RESOLVED one is the path
 * that actually fires and it was the one printing "Operation failed".
 */
export function useProductEditorFetch(productId: string) {
  const { t } = useTranslation();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);
    try {
      // No `?type=` hint (PR2e): derive the kind by fetching. GET /api/Products/{id} has no
      // type filter, so it returns a bundle too, carrying `type: 'menu'`. A bundle then needs
      // its proper shape — MenuBundleDto formats the schedule times as strings, ProductDto as
      // raw TimeSpans — so re-fetch via the Menus endpoint. One extra request, bundles only.
      const productResponse = (await getProductById(productId)) as {
        success: boolean;
        data?: ProductDetails;
        message?: string;
      };

      if (!productResponse.success || !productResponse.data) {
        // The RESOLVED refusal, and the one that actually fires: `ProductsController.GetProduct`
        // returns `Ok(result)` unconditionally, so `GetProductByIdQuery`'s
        // `ApiResponse.Failure("Product not found")` arrives as **200 + success:false** and never
        // reaches the catch below. `.message` on that shape is the factory's default parameter,
        // the literal "Operation failed" — so this line printed exactly the placeholder the rest
        // of this slice exists to stop, on the most ordinary path there is: opening a product that
        // was deleted in another tab.
        setError(serverMessages(productResponse)[0] ?? t('product_not_found'));
        return;
      }

      if (!isMenuBundle(productResponse.data)) {
        setProduct(productResponse.data);
        return;
      }

      const bundleResponse = (await getMenuBundleById(productId)) as {
        success: boolean;
        data?: ProductDetails;
        message?: string;
      };

      if (bundleResponse.success && bundleResponse.data) {
        setProduct(bundleResponse.data);
      } else {
        // Near-dead — `MenusController` returns `NotFound(result)`, so a missing bundle THROWS and
        // lands in the catch. Aligned anyway: two readers of one shape that disagree is how the
        // resolved branch above went unnoticed for as long as it did.
        setError(serverMessages(bundleResponse)[0] ?? t('product_not_found'));
      }
    } catch (err) {
      // Both fetches go through `apiClient`, which THROWS on every non-2xx — so a 403 (not an
      // admin for this tenant), a 409 and a genuine 404 all landed here and all printed "Product
      // not found", when only one of them meant it. `serverMessages` reads the thrown shape AND a
      // resolved `success:false`.
      //
      // What this does NOT fix, so nobody goes looking: a 401. `apiClient` throws
      // `ApiError(401, '')` — empty message, deliberately, because on that path the server was
      // either never asked or its words end at the sign-out — so the fallback below still renders,
      // and on an expired refresh `clearAuthAndRedirect()` navigates away before it could be read.
      // Telling an admin their session lapsed is a change in `apiClient`, not here.
      setError(serverMessages(err)[0] ?? t('product_not_found'));
    } finally {
      setIsLoading(false);
    }
  }, [productId, t]);

  useEffect(() => {
    // `refetch` sets its own error state; fire-and-forget.
    void refetch();
  }, [refetch]);

  return { product, isLoading, error, refetch };
}

export default useProductEditorFetch;
