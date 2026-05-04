'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import TableStatisticsCharts from '@/components/admin/table-statistics/TableStatisticsCharts';
import TablesGridSection from '@/components/admin/table-statistics/TablesGridSection';
import { useTableStatistics } from '@/hooks/admin/useTableStatistics';
import styles from './styles.module.css';

function TableStatisticsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tables, loading, stats, reservationStats, tableReservationStats, mostPopularTables } = useTableStatistics();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('loading_statistics', 'Loading statistics...')}</div>
      </div>
    );
  }

  return (
    <AdminAuthGuard>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('table_statistics', 'Table Statistics')}</h1>
            <p className={styles.subtitle}>
              {t('table_statistics_desc', 'Overview of your restaurant table inventory and capacity')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => router.push('/admin/table-layout-editor')} className={styles.layoutButton}>
              {t('manage_layout', 'Manage Layout')}
            </button>
          </div>
        </div>

        <TableStatisticsCharts
          {...stats}
          totalReservations={reservationStats.total}
          confirmedReservations={reservationStats.confirmed}
          completedReservations={reservationStats.completed}
          cancelledReservations={reservationStats.cancelled}
          noShowReservations={reservationStats.noShow}
        />

        <TablesGridSection
          tables={tables}
          tableReservationStats={tableReservationStats}
          mostPopularTables={mostPopularTables}
        />
      </div>
    </AdminAuthGuard>
  );
}

export default TableStatisticsPage;
