'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';

const LazyTableGuestVisitProvider = dynamic(
  () => import('@/contexts/TableGuestVisitProvider').then((module) => module.TableGuestVisitProvider),
  { loading: () => <p role="status" aria-label="Loading" /> },
);

export default function TableGuestVisitBoundary({
  forceLoad = false,
  children,
}: Readonly<{ forceLoad?: boolean; children: ReactNode }>) {
  const { tableGuestVisitsV1 } = useTableGuestFeature();
  const shouldLoad = forceLoad || tableGuestVisitsV1 || hasStoredTableGuestState();
  if (!shouldLoad) return children;
  return <LazyTableGuestVisitProvider>{children}</LazyTableGuestVisitProvider>;
}
