'use client';

import { useEffect, useState } from 'react';
import { getProductById } from '@/services/menuService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';

export interface SideItemDetails {
  name: string;
  description?: string;
}

/** `GET /api/Products/{id}` — a refusal arrives as 200 + `success: false`, so `data` is optional. */
interface ProductDetailEnvelope {
  success: boolean;
  data?: { id: string; name: string; description?: string };
}

/**
 * The names behind the CHIPS of `SuggestedSideItemsPicker` — one read per selected id.
 *
 * **Why one request per id rather than one page (F8, the latent half).** This used to call
 * `getProducts(1, 100)` and look the selected ids up in that page. RUMI has 76 products, so it
 * worked — and would have silently stopped working at 101: a side item outside the first page fell
 * back to the `Item 3f2a9c11...` chip below with nothing saying why. `GetProductsQuery` has no
 * by-ids filter, so the honest choices were to add one, to page through, or to fetch each id. Each
 * id is the smallest correct one: the count is the number of side items an admin picked for ONE
 * dish (a handful), the requests are parallel, and it has no cliff to document.
 *
 * **Errors are surfaced, not swallowed.** On failure the map stays empty and the chip falls through
 * to `` `Item ${id.substring(0, 8)}...` `` — an id where a dish name belongs. `Promise.allSettled`
 * keeps the names that DID resolve while still reporting that something did not, because a partial
 * answer is strictly better than none and hiding the failure is what this replaces.
 */
export function useSideItemDetails(selectedSideItemIds: string[]) {
  // Through a ref, NOT a dependency: listing `t` would refetch the details on every language
  // switch. See `useStableT` for why a unit test does not show that.
  const tRef = useStableT();
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedItemsDetails, setSelectedItemsDetails] = useState<Map<string, SideItemDetails>>(new Map());

  // Depend on a serialized key so the effect only re-runs when the actual IDs change; the array
  // reference is unstable across parent renders.
  const idKey = selectedSideItemIds.join(',');

  useEffect(() => {
    // Race guard: rapid changes to `selectedSideItemIds` can land an older fetch after a newer
    // one, so we use the cancellation-flag pattern (same idiom as `useGuestProfilePrefill`) to
    // suppress stale state writes — including the error writes below.
    let cancelled = false;

    const fetchSelectedItemsDetails = async () => {
      const ids = idKey ? idKey.split(',') : [];
      if (ids.length === 0) {
        if (!cancelled) {
          setSelectedItemsDetails(new Map());
          setDetailsError(null);
        }
        return;
      }

      const settled = await Promise.allSettled(
        ids.map(async (id) => (await getProductById(id)) as ProductDetailEnvelope),
      );
      if (cancelled) return;

      const detailsMap = new Map<string, SideItemDetails>();
      // One entry per FAILED id, `null` where the server said nothing worth showing — so the count
      // says "something failed" and the contents say why, which one nullable string cannot.
      const failures: Array<string | null> = [];

      settled.forEach((outcome, index) => {
        if (outcome.status === 'rejected') {
          failures.push(getErrorMessage(outcome.reason));
          return;
        }
        const resp = outcome.value;
        if (!resp?.success || !resp.data) {
          // A 200-wrapped refusal. `getProductById` returns the envelope rather than throwing, so
          // without this branch a `success: false` read exactly like a product with no name — and
          // `serverMessage` because the reason is in `errors[]`, `message` being "Operation
          // failed" on the one-argument `Failure`.
          failures.push(serverMessage(resp));
          return;
        }
        detailsMap.set(ids[index], { name: resp.data.name, description: resp.data.description });
      });

      setSelectedItemsDetails(detailsMap);
      setDetailsError(
        failures.length === 0
          ? null
          : (failures.find((message) => message) ??
              tRef.current('side_items_load_failed', 'Could not load the selected side items')),
      );
    };

    // `fetchSelectedItemsDetails` reports its own failures into `detailsError`; fire-and-forget.
    void fetchSelectedItemsDetails();

    return () => {
      cancelled = true;
    };
  }, [idKey, tRef]);

  return { detailsError, selectedItemsDetails };
}

export default useSideItemDetails;
