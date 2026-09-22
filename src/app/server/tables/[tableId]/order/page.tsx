'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ServerPage from '@/app/server/page';
import ServerTableRoundWorkspace from '@/components/server/table-round/ServerTableRoundWorkspace';
import { useServerTableSession } from '@/hooks/serverWorkspace/useServerTableSession';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

function ServerTableRoundRoute() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const tableId = decodeURIComponent(params.tableId ?? '');
  const requestedSessionId = searchParams.get('serviceSessionId') ?? undefined;
  const state = useServerTableSession(tableId);
  return <ServerTableRoundWorkspace tableId={tableId} requestedSessionId={requestedSessionId} state={state} />;
}

export default function ServerTableRoundPage() {
  const { serverWorkspaceV2 } = useTenantFeatures();
  return serverWorkspaceV2 ? <ServerTableRoundRoute /> : <ServerPage />;
}
