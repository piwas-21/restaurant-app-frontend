import React from 'react';
import { Search, Filter } from 'lucide-react';
import { ReservationStatus, TableDto } from '@/types/reservation';
import styles from './ReservationsFilters.module.css';

interface ReservationsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatus: ReservationStatus | 'All';
  onStatusChange: (status: ReservationStatus | 'All') => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedTableId: string;
  onTableChange: (tableId: string) => void;
  tables: TableDto[];
  searchPlaceholder: string;
  allStatusesLabel: string;
  statusLabels: {
    pending: string;
    confirmed: string;
    cancelled: string;
    completed: string;
    noShow: string;
  };
  allTablesLabel: string;
  tableLabel: string;
}

export const ReservationsFilters: React.FC<ReservationsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedDate,
  onDateChange,
  selectedTableId,
  onTableChange,
  tables,
  searchPlaceholder,
  allStatusesLabel,
  statusLabels,
  allTablesLabel,
  tableLabel,
}) => {
  return (
    <div className={styles.filters}>
      <div className={styles.searchBox}>
        <Search size={20} />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.filterGroup}>
        <Filter size={16} />
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as ReservationStatus | 'All')}
          className={styles.filterSelect}
        >
          <option value="All">{allStatusesLabel}</option>
          <option value={ReservationStatus.Pending}>{statusLabels.pending}</option>
          <option value={ReservationStatus.Confirmed}>{statusLabels.confirmed}</option>
          <option value={ReservationStatus.Cancelled}>{statusLabels.cancelled}</option>
          <option value={ReservationStatus.Completed}>{statusLabels.completed}</option>
          <option value={ReservationStatus.NoShow}>{statusLabels.noShow}</option>
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className={styles.filterInput}
        />

        <select
          value={selectedTableId}
          onChange={(e) => onTableChange(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="All">{allTablesLabel}</option>
          {tables.map(table => (
            <option key={table.id} value={table.id}>
              {tableLabel} {table.tableNumber}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
