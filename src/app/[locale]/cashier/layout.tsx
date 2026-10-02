import type { ReactNode } from 'react';
import { getTenantFeatures } from '@/services/tenantFeaturesService';
import CashierLayoutClient from './cashier-layout-client';

export default async function CashierLayout({ children }: Readonly<{ children: ReactNode }>) {
  const features = await getTenantFeatures();
  return <CashierLayoutClient features={features}>{children}</CashierLayoutClient>;
}
