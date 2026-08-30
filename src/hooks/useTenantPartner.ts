'use client';

import { useEffect, useState } from 'react';
import { getTenantPartner } from '@/services/tenantPartnerService';
import type { TenantPartnerDto } from '@/types/tenantPartner';

/**
 * The partner attribution this tenant was provisioned with (SOFRA-PARTNER-PLAN §11d).
 *
 * Same shape as {@link useRestaurantInfo}: a module-scope cache shared by every consumer
 * plus a single in-flight promise, so the four footers that can mount over one session
 * issue one request between them. The TTL is much longer, because this datum only changes
 * on a RE-PROVISION — a registry edit is not live until the tenant's containers are
 * recreated — where restaurant info is edited by the restaurant in tenant admin.
 *
 * It has no invalidation path for the same reason: nothing in this app can change it.
 * {@link invalidateTenantPartnerCache} exists so tests can start from a cold cache.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheState {
  data: TenantPartnerDto | null;
  fetchedAt: number;
  /** Single in-flight promise so concurrent first reads don't all hit the API. */
  inflight: Promise<TenantPartnerDto | null> | null;
}

const cache: CacheState = { data: null, fetchedAt: 0, inflight: null };

/** Force the next read to bypass the cache. Test seam — no production caller. */
export const invalidateTenantPartnerCache = () => {
  cache.data = null;
  cache.fetchedAt = 0;
  cache.inflight = null;
};

const isFresh = () => cache.fetchedAt !== 0 && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

const loadFromApi = async (): Promise<TenantPartnerDto | null> => {
  if (cache.inflight) return cache.inflight;
  cache.inflight = (async () => {
    try {
      const response = await getTenantPartner();
      cache.data = response.data ?? null;
    } catch (error) {
      // IGNORED ON PURPOSE. An unreachable backend, an older backend with no such route, a
      // malformed body — all mean "show no credit", which is what the footer rendered before
      // this existed. A footer line must never be able to break a restaurant's page, and it
      // must never delay one either.
      //
      // Bound rather than bare (the E9 ratchet) and reported to the console, which is the only
      // honest surface here: there is no message to show a diner about a footer line they were
      // never told to expect, so "surface it" means "leave a trace for whoever provisions the
      // tenant", not "put a failure in front of a customer".
      console.warn('[tenant-partner] attribution unavailable — rendering no credit', error);
      cache.data = null;
    } finally {
      cache.fetchedAt = Date.now();
      cache.inflight = null;
    }
    // The FAILURE is cached too, deliberately: a backend that is down would otherwise be
    // re-asked on every navigation for a line nobody is waiting for.
    return cache.data;
  })();
  return cache.inflight;
};

/**
 * @returns the attribution to display, or `null` while it is unknown, absent, or
 *          unreachable. Those three are one branch on purpose — see `PartnerCredit`.
 */
export function useTenantPartner(): TenantPartnerDto | null {
  // Deliberately NOT seeded from the module cache. The server renders no credit at all, so a
  // warm cache would make the first client render disagree with the SSR HTML.
  const [partner, setPartner] = useState<TenantPartnerDto | null>(null);

  useEffect(() => {
    let active = true;
    if (isFresh()) {
      setPartner(cache.data);
      return;
    }
    void loadFromApi().then((data) => {
      if (active) setPartner(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return partner;
}
