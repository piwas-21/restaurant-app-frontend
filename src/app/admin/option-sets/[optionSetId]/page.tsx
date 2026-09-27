'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import OptionSetEditorWorkspace from '@/components/admin/option-sets/OptionSetEditorWorkspace';

export default function OptionSetDetailPage() {
  const params = useParams<{ optionSetId: string }>();
  return (
    <AdminAuthGuard>
      <OptionSetEditorWorkspace id={params.optionSetId} />
    </AdminAuthGuard>
  );
}
