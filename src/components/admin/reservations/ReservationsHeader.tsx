import React from 'react';
import { Calendar, List, CalendarDays, RefreshCw } from 'lucide-react';
import styles from './ReservationsHeader.module.css';

type ViewMode = 'list' | 'calendar';

interface ReservationsHeaderProps {
  title: string;
  subtitle: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  listViewLabel: string;
  calendarViewLabel: string;
  refreshLabel: string;
}

export const ReservationsHeader: React.FC<ReservationsHeaderProps> = ({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
  onRefresh,
  listViewLabel,
  calendarViewLabel,
  refreshLabel,
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>
          <Calendar size={32} />
          {title}
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.viewToggle}>
          <button
            onClick={() => onViewModeChange('list')}
            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
            title={listViewLabel}
          >
            <List size={20} />
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`${styles.viewButton} ${viewMode === 'calendar' ? styles.active : ''}`}
            title={calendarViewLabel}
          >
            <CalendarDays size={20} />
          </button>
        </div>
        <button onClick={onRefresh} className={styles.refreshButton} title={refreshLabel}>
          <RefreshCw size={20} />
          {refreshLabel}
        </button>
      </div>
    </div>
  );
};
