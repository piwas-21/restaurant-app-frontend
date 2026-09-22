'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ServerPage from '@/app/server/page';
import ServerTableWorkspace from '@/components/server/ServerTableWorkspace';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

function ServerTableRoute() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const tableId = decodeURIComponent(params.tableId ?? '');
  const state = useServerTableSession(tableId);
  return (
    <ServerTableWorkspace
      tableId={tableId}
      state={state}
      requestedSessionId={searchParams.get('serviceSessionId') ?? undefined}
      requestedOrderId={searchParams.get('orderId') ?? undefined}
    />
  );
}

export default function ServerTablePage() {
  const { serverWorkspaceV2 } = useTenantFeatures();
  return serverWorkspaceV2 ? <ServerTableRoute /> : <ServerPage />;
}
