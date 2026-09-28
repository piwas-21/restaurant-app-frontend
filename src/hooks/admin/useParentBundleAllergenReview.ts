'use client';

import { useCallback, useEffect, useState } from 'react';
import { getProductParentBundles, type ProductParentBundle } from '@/services/productParentBundlesService';

type ParentBundleReviewState =
  | { readonly status: 'idle' | 'loading' | 'failed' }
  | { readonly status: 'ready'; readonly bundles: readonly ProductParentBundle[] };

interface ParentBundleReviewOptions {
  readonly isOpen: boolean;
  readonly productId: string;
  readonly recipeChanged: boolean;
  readonly currentAllergens: unknown;
  readonly savedAllergens: readonly string[] | null;
}

function normalizedLabels(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .filter((label): label is string => typeof label === 'string')
    .sort((left, right) => left.localeCompare(right))
    .join('\u0000');
}

/** Refresh parent references only when a saved child's recipe or allergen labels changed. */
export function useParentBundleAllergenReview({
  isOpen,
  productId,
  recipeChanged,
  currentAllergens,
  savedAllergens,
}: ParentBundleReviewOptions) {
  const [state, setState] = useState<ParentBundleReviewState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);
  const needsReview =
    Boolean(productId) && (recipeChanged || normalizedLabels(currentAllergens) !== normalizedLabels(savedAllergens));

  useEffect(() => {
    if (!isOpen || !productId || !needsReview) {
      setState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });
    void getProductParentBundles(productId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setState(
          response.success && response.data ? { status: 'ready', bundles: response.data.items } : { status: 'failed' },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'failed' });
      });

    return () => controller.abort();
  }, [isOpen, needsReview, productId, retryCount]);

  const retry = useCallback(() => setRetryCount((current) => current + 1), []);
  return { state, retry, needsReview };
}
