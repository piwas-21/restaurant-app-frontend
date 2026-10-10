'use client';

import { useEffect, useState } from 'react';
import { getTenantPartner } from '@/services/tenantPartnerService';
import { TENANT_BRANDING_CONFIG } from '@/lib/config';
import type { TenantPartnerDto } from '@/types/tenantPartner';

interface CacheState {
  data: TenantPartnerDto | null;
  attemptedAt: number;
  succeededAt: number;
  inflight: Promise<TenantPartnerDto | null> | null;
}
const cache: CacheState = { data: null, attemptedAt: 0, succeededAt: 0, inflight: null };

export const invalidateTenantPartnerCache = () => {
  cache.data = null;
  cache.attemptedAt = 0;
  cache.succeededAt = 0;
  cache.inflight = null;
};

const currentValue = () => (Date.now() - cache.succeededAt <= TENANT_BRANDING_CONFIG.maxStaleMs ? cache.data : null);

const loadFromApi = async (): Promise<TenantPartnerDto | null> => {
  if (cache.inflight) return cache.inflight;
  if (cache.attemptedAt && Date.now() - cache.attemptedAt < TENANT_BRANDING_CONFIG.refreshMs) return currentValue();
  cache.attemptedAt = Date.now();
  cache.inflight = (async () => {
    try {
      const response = await getTenantPartner();
      cache.data = response.data ?? null;
      cache.succeededAt = Date.now();
    } catch (error) {
      console.warn('[tenant-partner] attribution refresh unavailable', error);
    } finally {
      cache.inflight = null;
    }
    return currentValue();
  })();
  return cache.inflight;
};

/** Revalidates mounted footers too; publication and withdrawal need no reload. */
export function useTenantPartner(): TenantPartnerDto | null {
  const [partner, setPartner] = useState<TenantPartnerDto | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      setPartner(currentValue());
      void loadFromApi().then((value) => {
        if (active) setPartner(value);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, TENANT_BRANDING_CONFIG.refreshMs);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return partner;
}
