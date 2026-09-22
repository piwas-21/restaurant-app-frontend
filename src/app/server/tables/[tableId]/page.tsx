'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import ServerFloorTableCard from '@/components/server/ServerFloorTableCard';
import ServerPage from '@/app/server/page';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useServerFloorSnapshot } from '@/hooks/serverWorkspace/useServerFloorSnapshot';
import styles from '@/components/server/ServerFloorWorkspace.module.css';

function ServerTableRouteShell() {
  const { t } = useTranslation();
  const params = useParams<{ tableId: string }>();
  const tableId = decodeURIComponent(params.tableId ?? '');
  const floor = useServerFloorSnapshot();
  const table = floor.snapshot?.tables.find((candidate) => candidate.tableId === tableId) ?? null;

  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.table', 'Floor'), active: false },
        { href: '/server/takeaway', label: t('server.takeaway.link') },
      ]}
      connectionState={floor.connectionState}
      lastConfirmed={floor.snapshot?.serverTime}
      onRetryConnection={() => void floor.refresh()}
      className={styles.shell}
    >
      <div className={styles.workspace}>
        <header className={styles.heading}>
          <div>
            <h1>{t('server.table_info', 'Table Information')}</h1>
            <p>{t('staff.workspace', 'Staff workspace')}</p>
          </div>
          <Link className={styles.control} href="/server/floor">
            {t('back', 'Back')}
          </Link>
        </header>
        {!floor.snapshot && floor.isLoading && <div className={styles.statePanel}>{t('loading', 'Loading')}</div>}
        {!floor.snapshot && !floor.isLoading && (
          <div className={styles.statePanel} role="alert">
            {t('floor_plan_load_error', 'The floor plan could not load.')}
          </div>
        )}
        {floor.snapshot && !table && (
          <div className={styles.statePanel} role="alert">
            {t('cashier.tables.session_unavailable', 'This table visit is unavailable.')}
          </div>
        )}
        {table && (
          <section className={styles.detailPanel} aria-label={t('server.table_info', 'Table Information')}>
            <ServerFloorTableCard table={table} selected />
          </section>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

export default function ServerTablePage() {
  const { serverWorkspaceV2 } = useTenantFeatures();
  return serverWorkspaceV2 ? <ServerTableRouteShell /> : <ServerPage />;
}
