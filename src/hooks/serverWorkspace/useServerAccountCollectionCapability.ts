'use client';

import { useOptionalAuth } from '@/components/AuthContext';
import { useModules } from '@/contexts/ModulesContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { canStartServerAccountCollection } from '@/lib/serverAccountCollectionCapability';
import type { TableServiceSessionDto } from '@/types/order';

export function useServerAccountCollectionCapability(session: TableServiceSessionDto | null): boolean {
  const auth = useOptionalAuth();
  const features = useTenantFeatures();
  const modules = useModules();
  return canStartServerAccountCollection({
    role: auth?.user?.role,
    tableAccountPaymentsV1: features.tableAccountPaymentsV1,
    serverAccountCollectionV1: features.serverAccountCollectionV1,
    serverModuleEnabled: modules.has('server'),
    cashierModuleEnabled: modules.has('cashier'),
    sessionCanCollect: session?.canCollect === true,
    sessionOpen: session?.status === 'Open',
  });
}
