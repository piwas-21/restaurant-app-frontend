import React from 'react';
import styles from './ReservationsStats.module.css';

interface ReservationsStatsProps {
  total: number;
  pending: number;
  confirmed: number;
  totalLabel: string;
  pendingLabel: string;
  confirmedLabel: string;
}

export const ReservationsStats: React.FC<ReservationsStatsProps> = ({
  total,
  pending,
  confirmed,
  totalLabel,
  pendingLabel,
  confirmedLabel,
}) => {
  return (
    <div className={styles.stats}>
      <div className={styles.statCard}>
        <div className={styles.statValue}>{total}</div>
        <div className={styles.statLabel}>{totalLabel}</div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statValue}>{pending}</div>
        <div className={styles.statLabel}>{pendingLabel}</div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statValue}>{confirmed}</div>
        <div className={styles.statLabel}>{confirmedLabel}</div>
      </div>
    </div>
  );
};
