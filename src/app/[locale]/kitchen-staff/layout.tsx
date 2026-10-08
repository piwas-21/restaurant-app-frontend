import type { ReactNode } from 'react';
import { TenantFeaturesProvider } from '@/contexts/TenantFeaturesContext';
import { getTenantFeatures } from '@/services/tenantFeaturesService';

export default async function KitchenStaffLayout({ children }: Readonly<{ children: ReactNode }>) {
  const features = await getTenantFeatures();
  return <TenantFeaturesProvider features={features}>{children}</TenantFeaturesProvider>;
}
