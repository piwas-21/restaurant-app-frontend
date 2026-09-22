'use client';

import { useParams } from 'next/navigation';
import ServerPage from '@/app/server/page';
import ServerTableWorkspace from '@/components/server/ServerTableWorkspace';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

function ServerTableRoute() {
  const params = useParams<{ tableId: string }>();
  const tableId = decodeURIComponent(params.tableId ?? '');
  const state = useServerTableSession(tableId);
  return <ServerTableWorkspace tableId={tableId} state={state} />;
}

export default function ServerTablePage() {
  const { serverWorkspaceV2 } = useTenantFeatures();
  return serverWorkspaceV2 ? <ServerTableRoute /> : <ServerPage />;
}
