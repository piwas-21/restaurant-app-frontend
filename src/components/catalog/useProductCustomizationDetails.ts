'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProductById } from '@/services/menuService';
import { useApiError } from '@/hooks/useApiError';
import type { ProductCustomizationDetail } from './productCustomizationTypes';

/**
 * The customization payload behind the waiter's sheet, and the SENTENCE for when it does not
 * arrive.
 *
 * The defect this closes: the fetch lived in the component as `catch (err) { console.error(...) }`
 * — a bound catch the bare-catch ratchet cannot see (`scripts/check-bare-catch.mjs` counts catches
 * with no binding) — and the sheet simply stopped loading. What the waiter got was a modal with no
 * variations, no extras, no allergens, no reason, and since F2 not even a pre-selected variation:
 * indistinguishable from a product that genuinely has no options, mid-service, with a guest
 * waiting. The `success: false` half was worse than silent — `if (response.success && response.data)`
 * had no else at all, so a refusal inside a 200 (`Ok(ApiResponse.Failure(...))`) never even
 * reached the log.
 *
 * E9 shape: `useApiError`, because the sheet HOLDS its state and can render the reason where the
 * options would have been. A toast would be wrong here — it outlives nothing and the sheet would
 * still be blank behind it.
 */
export function useProductCustomizationDetails(productId: string | undefined, isOpen: boolean) {
  const { t } = useTranslation();
  // `t` through a ref so it is not a dependency: i18next replaces it on a language change and a
  // test stub replaces it on every render, either of which would re-fetch for no reason.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [detail, setDetail] = useState<ProductCustomizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { message, capture, clear } = useApiError();
  // Which request is the current one. A waiter who retries, or tabs between two products faster
  // than the network answers, must not have a stale reply — or a stale FAILURE — land on the sheet
  // in front of them.
  const attemptRef = useRef(0);

  const load = useCallback(async () => {
    if (!productId) return;
    const attempt = ++attemptRef.current;
    const fallback = tRef.current('error_loading_product', 'Failed to load product details');
    setIsLoading(true);
    try {
      const response = (await getProductById(productId)) as {
        success: boolean;
        data?: ProductCustomizationDetail;
      };
      if (attempt !== attemptRef.current) return;
      if (!response.success || !response.data) {
        // Keep the sheet empty rather than showing the previous product's options beside a
        // failure — but SAY so. `capture` reads the resolved shape as well as the thrown one.
        setDetail(null);
        capture(response, { fallback });
        return;
      }
      setDetail(response.data);
      clear();
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      setDetail(null);
      capture(err, { fallback });
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
    }
  }, [productId, capture, clear]);

  useEffect(() => {
    if (!isOpen || !productId) return;
    // `load` sets its own error state; fire-and-forget.
    void load();
  }, [isOpen, productId, load]);

  return { detail, isLoading, error: message, reload: load };
}

export default useProductCustomizationDetails;
