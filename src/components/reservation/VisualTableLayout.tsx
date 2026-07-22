'use client';

import { useTranslation } from 'react-i18next';
import TableMarker from '@/components/table-layout/TableMarker';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { DEFAULT_ENTRANCE_POSITION } from '@/lib/tableCanvasGeometry';
import { TableDto } from '@/types/reservation';
import styles from './VisualTableLayout.module.css';

interface VisualTableLayoutProps {
  tables: TableDto[];
  selectedTableIds?: string[];
  onSelectTable: (table: TableDto) => void;
  bookedTableIds?: string[];
}

type TableStatus = 'available' | 'booked' | 'selected';

export default function VisualTableLayout({
  tables,
  selectedTableIds = [],
  onSelectTable,
  bookedTableIds = [],
}: Readonly<VisualTableLayoutProps>) {
  const { t } = useTranslation();
  const { info } = useRestaurantInfo();

  // Entrance position is admin-placed data on the RestaurantInfo singleton;
  // fall back to the default until the fields exist / are set.
  const entrancePosition = {
    x: info?.entrancePositionX ?? DEFAULT_ENTRANCE_POSITION.x,
    y: info?.entrancePositionY ?? DEFAULT_ENTRANCE_POSITION.y,
  };

  const getTableStatus = (table: TableDto): TableStatus => {
    if (selectedTableIds.includes(table.id)) return 'selected';
    if (bookedTableIds.includes(table.id)) return 'booked';
    return 'available';
  };

  const statusLabels: Record<TableStatus, string> = {
    available: t('available', 'Available'),
    booked: t('booked', 'Booked'),
    selected: t('selected', 'Selected'),
  };

  return (
    <div className={styles.container}>
      <div className={styles.floorPlan} role="group" aria-label={t('select_your_tables', 'Select your Table(s)')}>
        {/* Entrance marker */}
        <div
          className={styles.entrance}
          style={{ left: `${entrancePosition.x}%`, top: `${entrancePosition.y}%` }}
          data-label={t('entrance', 'Entrance')}
          aria-hidden="true"
        >
          🚪
        </div>

        {/* Tables */}
        {tables.map((table) => {
          const status = getTableStatus(table);
          return (
            <TableMarker
              key={table.id}
              tableNumber={table.tableNumber}
              maxGuests={table.maxGuests}
              positionX={table.positionX}
              positionY={table.positionY}
              className={styles[status]}
              ariaLabel={t('table_marker_aria', 'Table {{number}}, {{seats}} seats, {{status}}', {
                number: table.tableNumber,
                seats: table.maxGuests,
                status: statusLabels[status],
              })}
              ariaPressed={status === 'selected'}
              disabled={status === 'booked'}
              onClick={() => onSelectTable(table)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.legendAvailable}`} />
          <span>{t('available', 'Available')}</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.legendBooked}`} />
          <span>{t('booked', 'Booked')}</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.legendSelected}`} />
          <span>{t('selected', 'Selected')}</span>
        </div>
      </div>
    </div>
  );
}
