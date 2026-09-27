import React, { Suspense } from 'react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import CatalogueTemplateBrowser from '@/components/admin/catalogue/CatalogueTemplateBrowser';

export default function CatalogueBrowserPage() {
  return (
    <AdminAuthGuard>
      <Suspense
        fallback={
          <main>
            <output>Loading…</output>
          </main>
        }
      >
        <CatalogueTemplateBrowser />
      </Suspense>
    </AdminAuthGuard>
  );
}
