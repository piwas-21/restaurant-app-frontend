'use client';

import { useTranslation } from 'react-i18next';
import type { TableDto } from '@/types/reservation';
import type { TableReservationStats } from '@/hooks/admin/useTableStatistics';
import styles from '@/app/admin/table-statistics/styles.module.css';

interface TablesGridSectionProps {
  tables: TableDto[];
  tableReservationStats: TableReservationStats[];
  mostPopularTables: TableReservationStats[];
}

/**
 * "Most Popular Tables" + "All Tables with Reservation Stats" sections.
 * Both render off the same per-table stats slice.
 */
export default function TablesGridSection({
  tables,
  tableReservationStats,
  mostPopularTables,
}: TablesGridSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      {mostPopularTables.length > 0 && (
        <div className={styles.popularTablesSection}>
          <h3 className={styles.sectionTitle}>{t('most_popular_tables', 'Most Popular Tables')}</h3>
          <div className={styles.popularTablesGrid}>
            {mostPopularTables.map((s, index) => (
              <div key={s.tableId} className={styles.popularTableCard}>
                <div className={styles.rankBadge}>#{index + 1}</div>
                <div className={styles.popularTableContent}>
                  <div className={styles.popularTableNumber}>{s.tableNumber}</div>
                  <div className={styles.popularTableStats}>
                    <Stat value={s.totalReservations} label={t('reservations', 'reservations')} />
                    <Stat value={s.averagePartySize} label={t('avg_party_size', 'avg party size')} />
                  </div>
                  <div className={styles.reservationBreakdown}>
                    <span className={`${styles.breakdownItem} ${styles.textConfirmed}`}>
                      ✓ {s.completedReservations}
                    </span>
                    <span className={`${styles.breakdownItem} ${styles.textCancelled}`}>
                      ✗ {s.cancelledReservations}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tablesSection}>
        <h3 className={styles.sectionTitle}>{t('all_tables_with_stats', 'All Tables with Reservation Stats')}</h3>
        <div className={styles.tableGrid}>
          {tables.map((table) => {
            const stats = tableReservationStats.find((s) => s.tableId === table.id);
            return (
              <div key={table.id} className={`${styles.tableCard} ${!table.isActive ? styles.inactive : ''}`}>
                <div className={styles.tableCardHeader}>
                  <span className={styles.tableNumber}>{table.tableNumber}</span>
                  <span className={`${styles.tableBadge} ${table.isActive ? styles.active : styles.inactiveStatus}`}>
                    {table.isActive ? t('active', 'Active') : t('inactive', 'Inactive')}
                  </span>
                </div>
                <div className={styles.tableCardDetails}>
                  <Detail
                    label={t('capacity', 'Capacity')}
                    value={t('seats_count', '{{count}} seats', { count: table.maxGuests })}
                  />
                  <Detail
                    label={t('location', 'Location')}
                    value={table.isOutdoor ? t('outdoor', 'Outdoor') : t('indoor', 'Indoor')}
                  />
                </div>
                {stats && stats.totalReservations > 0 && (
                  <div className={styles.tableReservationStats}>
                    <div className={styles.reservationStatsHeader}>📊 {t('reservations', 'Reservations')}</div>
                    <div className={styles.reservationStatsGrid}>
                      <ReservationStat value={stats.totalReservations} label={t('total', 'Total')} />
                      <ReservationStat value={stats.completedReservations} label={t('completed', 'Completed')} />
                      <ReservationStat value={stats.averagePartySize} label={t('avg_party', 'Avg Party')} />
                    </div>
                  </div>
                )}
                {table.notes && (
                  <div className={styles.tableNotes}>
                    <span className={styles.notesIcon}>📝</span>
                    {table.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.popularStat}>
      <span className={styles.popularStatValue}>{value}</span>
      <span className={styles.popularStatLabel}>{label}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.tableDetail}>
      <span className={styles.tableDetailLabel}>{label}:</span>
      <span className={styles.tableDetailValue}>{value}</span>
    </div>
  );
}

function ReservationStat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.reservationStatItem}>
      <span className={styles.reservationStatValue}>{value}</span>
      <span className={styles.reservationStatLabel}>{label}</span>
    </div>
  );
}
