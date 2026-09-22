'use client';

import ServerPage from '@/app/server/page';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import ServerTasksWorkspace from '@/components/server/tasks/ServerTasksWorkspace';

export default function ServerTasksPage() {
  const { serverWorkspaceV2 } = useTenantFeatures();
  return serverWorkspaceV2 ? <ServerTasksWorkspace /> : <ServerPage />;
}
