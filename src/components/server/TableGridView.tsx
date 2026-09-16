import React from 'react';
import { useTranslation } from 'react-i18next';
import { ServerTableDto } from '@/services/serverService';
import TableCard from './TableCard';
import styles from './TableGridView.module.css';

interface TableGridViewProps {
  readonly tables: readonly ServerTableDto[];
  readonly selectedTableNumber: string | null;
  readonly selectedTableId?: string | null;
  readonly onSelectTable: (tableNumber: string, tableId: string) => void;
  readonly isLoading?: boolean;
}

export default function TableGridView({
  tables,
  selectedTableNumber,
  selectedTableId,
  onSelectTable,
  isLoading,
}: TableGridViewProps) {
  const { t } = useTranslation();

  // Sort labels naturally without stripping characters: labels such as T-QA are valid table
  // identities and must not collapse into the same numeric bucket as another labelled table.
  const sortedTables = [...tables].sort((a, b) => {
    return a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Calculate stats
  const stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    closed: tables.filter((t) => t.status === 'closed').length,
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>{t('server.loading_tables', 'Loading tables...')}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('server.floor_plan', 'Floor Plan')}</h2>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statIcon}>🟢</span>
            <span>{stats.available}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statIcon}>🔵</span>
            <span>{stats.occupied}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statIcon}>🟡</span>
            <span>{stats.reserved}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statIcon}>⚫</span>
            <span>{stats.closed}</span>
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        {sortedTables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            isSelected={selectedTableId ? table.id === selectedTableId : table.tableNumber === selectedTableNumber}
            onClick={() => onSelectTable(table.tableNumber, table.id)}
          />
        ))}
      </div>

      {tables.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🪑</span>
          <span>{t('server.no_tables', 'No tables configured')}</span>
        </div>
      )}
    </div>
  );
}
