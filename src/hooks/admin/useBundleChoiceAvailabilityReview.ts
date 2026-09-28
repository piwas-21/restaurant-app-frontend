'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuSection } from '@/types/menu';
import { getAllProducts } from '@/services/menuService';
import { isStorableMask } from '@/utils/orderChannels';
import {
  assessBundleChoiceAvailability,
  resolveBundleParentOrderTypes,
  type BundleChoiceAvailabilityAssessment,
} from '@/utils/bundleChoiceAvailability';

type ReviewState =
  | { readonly status: 'idle' | 'loading' | 'failed' }
  | { readonly status: 'ready'; readonly assessment: BundleChoiceAvailabilityAssessment };

interface UseBundleChoiceAvailabilityReviewOptions {
  readonly isOpen: boolean;
  readonly isBundle: boolean;
  readonly isActive: boolean;
  readonly isChannelMaskValid: boolean;
  readonly availableOrderTypes: number | null;
  readonly parentProductId: string;
  readonly sections: readonly MenuSection[];
}

/** Refresh option summaries once per active bundle review, not on every editor render. */
export function useBundleChoiceAvailabilityReview({
  isOpen,
  isBundle,
  isActive,
  isChannelMaskValid,
  availableOrderTypes,
  parentProductId,
  sections,
}: UseBundleChoiceAvailabilityReviewOptions) {
  const [state, setState] = useState<ReviewState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const hasRequiredSection = sections.some((section) => section.isRequired);
  const sectionsKey = JSON.stringify(
    sections.map((section) => ({
      id: section.id,
      name: section.name,
      isRequired: section.isRequired,
      minSelection: section.minSelection,
      items: section.items.map((item) => ({
        productId: item.productId,
        productVariationId: item.productVariationId ?? null,
      })),
    })),
  );

  useEffect(() => {
    if (!isOpen || !isBundle || !isActive || !hasRequiredSection) {
      setState({ status: 'idle' });
      return;
    }
    if (
      !isChannelMaskValid ||
      (typeof availableOrderTypes === 'number' &&
        (!Number.isInteger(availableOrderTypes) || !isStorableMask(availableOrderTypes)))
    ) {
      setState({ status: 'failed' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });
    void Promise.resolve()
      .then(() => getAllProducts(null, { includeMenus: true, includeComponents: true }, controller.signal))
      .then((products) => {
        if (controller.signal.aborted) return;
        const parentChannels = resolveBundleParentOrderTypes(availableOrderTypes, parentProductId, products);
        if (parentChannels.status !== 'ready') {
          setState({ status: 'failed' });
          return;
        }
        const result = assessBundleChoiceAvailability(sectionsRef.current, parentChannels.orderTypes, products);
        setState(result.status === 'ready' ? result : { status: 'failed' });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Could not refresh menu option availability for the pre-save review', error);
        setState({ status: 'failed' });
      });

    return () => controller.abort();
  }, [
    availableOrderTypes,
    hasRequiredSection,
    isActive,
    isBundle,
    isChannelMaskValid,
    isOpen,
    parentProductId,
    retryCount,
    sectionsKey,
  ]);

  const retry = useCallback(() => setRetryCount((current) => current + 1), []);

  return { state, retry };
}

export default useBundleChoiceAvailabilityReview;
