'use client';

import { useEffect, useRef } from 'react';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

export default function useCheckoutReviewPageView(): void {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackEvent('checkout_review_viewed', { loggedIn: isLoggedInForAnalytics() });
  }, []);
}
