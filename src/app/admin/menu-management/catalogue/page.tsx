import React from 'react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import CatalogueTemplateBrowser from '@/components/admin/catalogue/CatalogueTemplateBrowser';

export default function CatalogueBrowserPage() {
  return (
    <AdminAuthGuard>
      <CatalogueTemplateBrowser />
    </AdminAuthGuard>
  );
}
