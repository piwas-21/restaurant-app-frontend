'use client';

import type { ReactNode } from 'react';
import type { TableServiceSessionDto } from '@/types/order';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import TableAccountWorkspace from './TableAccountWorkspace';

interface TableAccountPresentationProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
  readonly fallback: ReactNode;
}

export default function TableAccountPresentation({ session, timeZone, fallback }: TableAccountPresentationProps) {
  const { tableAccountV1 } = useTenantFeatures();
  return tableAccountV1 ? <TableAccountWorkspace session={session} timeZone={timeZone} /> : fallback;
}
