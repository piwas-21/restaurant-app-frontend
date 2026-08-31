'use client';

import { useEffect, useState } from 'react';
import { getLandingPage } from '@/services/restaurantInfoService';
import type { LandingPageDto } from '@/types/landingPage';

/**
 * The tenant's landing-page configuration (background mode + per-language copy overrides).
 *
 * Same caching posture as {@link useRestaurantInfo}: a module-scope cache with a 30 s TTL and
 * a single in-flight promise, so the hero, the story section and any other consumer share one
 * request, and an admin save calls {@link invalidateLandingPageCache} so the guest site
 * reflects the edit on the next read rather than 30 s later.
 */
const CACHE_TTL_MS = 30_000;

interface CacheState {
  data: LandingPageDto | null;
  fetchedAt: number;
  inflight: Promise<LandingPageDto | null> | null;
}

const cache: CacheState = { data: null, fetchedAt: 0, inflight: null };

async function fetchLandingPage(): Promise<LandingPageDto | null> {
  try {
    const response = await getLandingPage();
    // A public endpoint that answers a failure envelope (restaurant info not yet initialised)
    // is not an error to surface: the templates fall back to the bundled copy, which is what
    // a brand-new tenant sees anyway.
    cache.data = response.success && response.data ? response.data : null;
  } catch (error) {
    // Deliberately downgraded, not swallowed blind (bare-catch gate): an unreachable landing
    // contract must not break the page. The templates fall back to the bundled copy, which is
    // exactly the state a tenant that never configured anything sees.
    console.warn('Failed to load the landing page configuration', error);
    cache.data = null;
  }
  cache.fetchedAt = Date.now();
  cache.inflight = null;
  return cache.data;
}

/** Force the next read to bypass the cache. Call after an admin landing save. */
export function invalidateLandingPageCache() {
  cache.fetchedAt = 0;
}

export function useLandingPage() {
  const [landing, setLanding] = useState<LandingPageDto | null>(cache.data);

  useEffect(() => {
    let cancelled = false;

    const fresh = () => Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    const read = () => {
      if (fresh()) {
        setLanding(cache.data);
        return;
      }
      cache.inflight ??= fetchLandingPage();
      void cache.inflight.then((data) => {
        if (!cancelled) setLanding(data);
      });
    };

    read();
    return () => {
      cancelled = true;
    };
  }, []);

  return { landing };
}
