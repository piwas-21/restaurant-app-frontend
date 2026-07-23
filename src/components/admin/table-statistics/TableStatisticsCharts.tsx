'use client';

import { useTranslation } from 'react-i18next';
import styles from '@/app/admin/table-statistics/styles.module.css';

interface TableStatisticsChartsProps {
  totalTables: number;
  activeTables: number;
  inactiveTables: number;
  indoorTables: number;
  outdoorTables: number;
  totalCapacity: number;
  activeCapacity: number;
  activePercentage: number;
  indoorPercentage: number;
  outdoorPercentage: number;
  smallTables: number;
  mediumTables: number;
  largeTables: number;
  extraLargeTables: number;
  totalReservations: number;
  completedReservations: number;
  confirmedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
}

/**
 * Top-of-page metrics + the two breakdown charts (status, location) +
 * the two detail cards (capacity, reservation status).
 */
export default function TableStatisticsCharts(p: TableStatisticsChartsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.metricsGrid}>
        <MetricCard icon="🪑" value={p.totalTables} label={t('total_tables', 'Total Tables')} />
        <MetricCard
          icon="✅"
          value={p.activeTables}
          label={t('active_tables', 'Active Tables')}
          subtext={t('of_total', '{{percent}}% of total', { percent: p.activePercentage.toFixed(1) })}
        />
        <MetricCard
          icon="👥"
          value={p.activeCapacity}
          label={t('active_seating_capacity', 'Active Seating Capacity')}
          subtext={t('total_seats', 'Total: {{count}} seats', { count: p.totalCapacity })}
        />
        <MetricCard
          icon="📅"
          value={p.totalReservations}
          label={t('total_reservations', 'Total Reservations')}
          subtext={t('completed_count', '{{count}} completed', { count: p.completedReservations })}
        />
      </div>

      <div className={styles.chartsGrid}>
        <ChartCard title={t('table_status', 'Table Status')}>
          <BreakdownBar
            label={t('active_tables', 'Active Tables')}
            value={p.activeTables}
            percent={p.activePercentage}
            colorClass={styles.colorActive}
          />
          <BreakdownBar
            label={t('inactive_tables', 'Inactive Tables')}
            value={p.inactiveTables}
            percent={100 - p.activePercentage}
            colorClass={styles.colorInactive}
          />
        </ChartCard>
        <ChartCard title={t('table_location', 'Table Location')}>
          <BreakdownBar
            label={t('indoor_tables', 'Indoor Tables')}
            value={p.indoorTables}
            percent={p.indoorPercentage}
            colorClass={styles.colorIndoor}
          />
          <BreakdownBar
            label={t('outdoor_tables', 'Outdoor Tables')}
            value={p.outdoorTables}
            percent={p.outdoorPercentage}
            colorClass={styles.colorOutdoor}
          />
        </ChartCard>
      </div>

      <div className={styles.detailsGrid}>
        <DetailCard title={t('capacity_distribution', 'Capacity Distribution')}>
          <DetailItem label={t('small_tables', 'Small (1-2 seats)')} value={p.smallTables} />
          <DetailItem label={t('medium_tables', 'Medium (3-4 seats)')} value={p.mediumTables} />
          <DetailItem label={t('large_tables', 'Large (5-6 seats)')} value={p.largeTables} />
          <DetailItem label={t('extra_large_tables', 'Extra Large (7+ seats)')} value={p.extraLargeTables} />
        </DetailCard>
        <DetailCard title={t('reservation_status', 'Reservation Status')}>
          <DetailItem
            dotClass={styles.colorConfirmed}
            label={t('confirmed', 'Confirmed')}
            value={p.confirmedReservations}
          />
          <DetailItem
            dotClass={styles.colorCompleted}
            label={t('completed', 'Completed')}
            value={p.completedReservations}
          />
          <DetailItem
            dotClass={styles.colorCancelled}
            label={t('cancelled', 'Cancelled')}
            value={p.cancelledReservations}
          />
          <DetailItem dotClass={styles.colorCancelled} label={t('no_show', 'No Show')} value={p.noShowReservations} />
        </DetailCard>
      </div>
    </>
  );
}

function MetricCard({ icon, value, label, subtext }: { icon: string; value: number; label: string; subtext?: string }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <div className={styles.metricContent}>
        <div className={styles.metricValue}>{value}</div>
        <div className={styles.metricLabel}>{label}</div>
        {subtext && <div className={styles.metricSubtext}>{subtext}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartContent}>
        <div className={styles.statusBreakdown}>{children}</div>
      </div>
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  percent,
  colorClass,
}: {
  label: string;
  value: number;
  percent: number;
  colorClass: string;
}) {
  return (
    <div className={styles.statusItem}>
      <div className={styles.statusHeader}>
        <span className={styles.statusLabel}>{label}</span>
        <span className={styles.statusValue}>{value}</span>
      </div>
      <div className={styles.progressBar}>
        <div className={`${styles.progressFill} ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.statusPercentage}>{percent.toFixed(1)}%</div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.detailCard}>
      <h3 className={styles.detailTitle}>{title}</h3>
      <div className={styles.detailList}>{children}</div>
    </div>
  );
}

function DetailItem({
  icon,
  dotClass,
  label,
  value,
}: {
  icon?: string;
  dotClass?: string;
  label: string;
  value: number;
}) {
  return (
    <div className={styles.detailItem}>
      <div className={styles.detailLabel}>
        {icon && <span className={styles.shapeIcon}>{icon}</span>}
        {dotClass && <span className={`${styles.statusDot} ${dotClass}`} />}
        {label}
      </div>
      <div className={styles.detailValue}>{value}</div>
    </div>
  );
}
