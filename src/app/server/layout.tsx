import type { ReactNode } from 'react';
import { getTenantFeatures } from '@/services/tenantFeaturesService';
import ServerLayoutClient from './server-layout-client';

/**
 * Reads the tenant-wide server rollout only for the server route subtree. Keeping this fetch
 * out of the root layout prevents the emergency no-store switch from making every app route
 * dynamic, while the nested client provider covers both /server and /server/takeaway.
 */
export default async function ServerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const features = await getTenantFeatures();
  return <ServerLayoutClient features={features}>{children}</ServerLayoutClient>;
}
