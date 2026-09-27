'use client';

import React from 'react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import OptionSetCatalog from '@/components/admin/option-sets/OptionSetCatalog';

export default function OptionSetsPage() {
  return (
    <AdminAuthGuard>
      <OptionSetCatalog />
    </AdminAuthGuard>
  );
}
