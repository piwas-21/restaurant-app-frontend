'use client';

import type { ReactNode } from 'react';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import CheckoutTableGuestStateBridge from '@/contexts/CheckoutTableGuestStateBridge';
import TableGuestVisitBoundary from '@/contexts/TableGuestVisitBoundary';

export default function TableGuestRouteRuntime({
  readPublicTableGuestFeature,
  loadTableGuestLocaleForRoute,
  children,
}: Readonly<{
  readPublicTableGuestFeature: boolean;
  loadTableGuestLocaleForRoute: boolean;
  children: ReactNode;
}>) {
  return (
    <TableGuestFeatureProvider
      readPublicTableGuestFeature={readPublicTableGuestFeature}
      loadTableGuestLocaleForRoute={loadTableGuestLocaleForRoute}
    >
      <TableGuestVisitBoundary forceLoad={loadTableGuestLocaleForRoute}>
        <CheckoutTableGuestStateBridge>{children}</CheckoutTableGuestStateBridge>
      </TableGuestVisitBoundary>
    </TableGuestFeatureProvider>
  );
}
