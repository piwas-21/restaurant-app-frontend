'use client';

import type { ReactNode } from 'react';
import type { TableServiceSessionDto } from '@/types/order';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import TableAccountWorkspace from './TableAccountWorkspace';
import TableServiceSessionBill from './TableServiceSessionBill';
import styles from './TableAccountPresentation.module.css';

interface TableAccountPresentationProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
  readonly fallback: ReactNode;
}

export default function TableAccountPresentation({ session, timeZone, fallback }: TableAccountPresentationProps) {
  const { tableAccountV1 } = useTenantFeatures();
  if (!tableAccountV1) return fallback;
  return (
    <>
      <TableAccountWorkspace session={session} timeZone={timeZone} />
      <div className={styles.printBill} data-testid="cashier-table-print-bill">
        <TableServiceSessionBill session={session} timeZone={timeZone} />
      </div>
    </>
  );
}
