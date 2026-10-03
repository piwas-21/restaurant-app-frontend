'use client';

import dynamic from 'next/dynamic';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

const TableGuestAdmissionCodeAction = dynamic(() => import('./TableGuestAdmissionCodeAction'), { ssr: false });

export default function TableGuestAdmissionCodeSlot({
  serviceSessionId,
  disabled,
}: Readonly<{ serviceSessionId: string; disabled: boolean }>) {
  const { tableGuestVisitsV1 } = useTenantFeatures();
  if (!tableGuestVisitsV1 || !serviceSessionId) return null;
  return <TableGuestAdmissionCodeAction enabled serviceSessionId={serviceSessionId} disabled={disabled} />;
}
