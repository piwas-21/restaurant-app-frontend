'use client';

import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertCircle } from 'lucide-react';
import styles from '../CashierDiagnostics.module.css';

interface RealtimeConnectionSectionProps {
  sseConnectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  sseLastEventTime: Date | null;
  sseError: string | null;
  onRefreshConnection: () => void;
}

/**
 * Real-time (SSE) connection status: state dot + status badge + last-activity
 * time + optional error box + "Refresh Connection" action. Presentational —
 * all data comes from the parent's diagnostics props.
 */
export default function RealtimeConnectionSection({
  sseConnectionState,
  sseLastEventTime,
  sseError,
  onRefreshConnection,
}: RealtimeConnectionSectionProps) {
  const { t } = useTranslation();

  const getTimeSinceLastEvent = () => {
    if (!sseLastEventTime) return 'Never';
    const seconds = Math.floor((new Date().getTime() - sseLastEventTime.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getConnectionStatusClass = () => {
    switch (sseConnectionState) {
      case 'connected':
        return styles.badgeConnected;
      case 'connecting':
        return styles.badgeConnecting;
      case 'error':
        return styles.badgeError;
      default:
        return '';
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div
          className={`${styles.dot} ${
            sseConnectionState === 'connected'
              ? styles.dotConnected
              : sseConnectionState === 'connecting'
                ? styles.dotConnecting
                : sseConnectionState === 'error'
                  ? styles.dotError
                  : styles.dotInactive
          }`}
        />
        <h4 className={styles.sectionTitle}>{t('real_time_connection') || 'Real-time Connection'}</h4>
      </div>

      <div className={styles.infoCard}>
        <div className={styles.row}>
          <span className={styles.label}>{t('status') || 'Status'}</span>
          <span className={`${styles.badge} ${getConnectionStatusClass()}`}>{sseConnectionState}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('last_activity') || 'Last Activity'}</span>
          <span className={styles.value}>{getTimeSinceLastEvent()}</span>
        </div>
        {sseError && (
          <div className={styles.errorBox}>
            <AlertCircle size={14} className={styles.errorIcon} />
            <p className={styles.errorText}>{sseError}</p>
          </div>
        )}
      </div>

      <button onClick={onRefreshConnection} className={`${styles.actionButton} ${styles.primaryButton}`}>
        <RefreshCw size={16} />
        {t('refresh_connection') || 'Refresh Connection'}
      </button>
    </div>
  );
}
