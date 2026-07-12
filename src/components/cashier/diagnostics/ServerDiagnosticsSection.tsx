'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertCircle, Server, Users, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { getEventsDiagnostics } from '@/services/cashierService';
import { SseDiagnostics, LogEntry, RecentError } from '@/types/diagnostics';
import styles from '../CashierDiagnostics.module.css';

/**
 * Server-side SSE diagnostics: self-contained unit that owns its own fetch,
 * loading/error/loaded state, the 5s auto-refresh toggle, and timestamp
 * formatting. Takes no props — it pulls everything from the diagnostics
 * endpoint via `getEventsDiagnostics()`.
 */
export default function ServerDiagnosticsSection() {
  const { t } = useTranslation();

  const [serverDiagnostics, setServerDiagnostics] = useState<SseDiagnostics | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchServerDiagnostics = useCallback(async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      const data = await getEventsDiagnostics();
      setServerDiagnostics(data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to fetch diagnostics');
    } finally {
      setServerLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    // fetchServerDiagnostics has its own try/catch (sets error state); fire-and-forget.
    void fetchServerDiagnostics();
  }, [fetchServerDiagnostics]);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchServerDiagnostics, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchServerDiagnostics]);

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Server size={16} style={{ color: 'var(--status-info)' }} />
        <h4 className={styles.sectionTitle}>{t('server_diagnostics') || 'Server Diagnostics'}</h4>
        <button
          onClick={fetchServerDiagnostics}
          className={styles.iconButton}
          disabled={serverLoading}
          title="Refresh server diagnostics"
        >
          <RefreshCw size={14} className={serverLoading ? styles.spinning : ''} />
        </button>
      </div>

      {serverLoading && !serverDiagnostics && (
        <div className={styles.infoCard}>
          <div className={styles.loadingRow}>
            <Loader size={16} className={styles.spinning} />
            <span>Loading server diagnostics...</span>
          </div>
        </div>
      )}

      {serverError && (
        <div className={styles.errorBox}>
          <AlertCircle size={14} className={styles.errorIcon} />
          <p className={styles.errorText}>{serverError}</p>
        </div>
      )}

      {serverDiagnostics && (
        <>
          {/* Connected Clients Summary */}
          <div className={styles.infoCard}>
            <div className={styles.row}>
              <span className={styles.label}>
                <Users size={14} style={{ marginRight: '6px' }} />
                Total Clients
              </span>
              <span className={`${styles.badge} ${styles.badgeConnected}`}>{serverDiagnostics.totalClients}</span>
            </div>
            <div className={styles.clientBreakdown}>
              <span className={styles.clientType}>Kitchen: {serverDiagnostics.kitchenClients}</span>
              <span className={styles.clientType}>Service: {serverDiagnostics.serviceClients}</span>
              <span className={styles.clientType}>Manager: {serverDiagnostics.managerClients}</span>
              <span className={styles.clientType}>Stock: {serverDiagnostics.stockClients}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>
                <CheckCircle size={14} style={{ marginRight: '6px', color: 'var(--color-material-green-500)' }} />
                Successful Sends
              </span>
              <span className={styles.value}>{serverDiagnostics.totalSuccessfulSends}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>
                <XCircle size={14} style={{ marginRight: '6px', color: 'var(--color-material-red-500)' }} />
                Failed Sends
              </span>
              <span
                className={styles.value}
                style={{ color: serverDiagnostics.totalFailedSends > 0 ? 'var(--color-material-red-500)' : 'inherit' }}
              >
                {serverDiagnostics.totalFailedSends}
              </span>
            </div>
            {serverDiagnostics.clientsWithErrors > 0 && (
              <div className={styles.row}>
                <span className={styles.label}>
                  <AlertCircle size={14} style={{ marginRight: '6px', color: 'var(--status-warning)' }} />
                  Clients with Errors
                </span>
                <span className={styles.value} style={{ color: 'var(--status-warning)' }}>
                  {serverDiagnostics.clientsWithErrors}
                </span>
              </div>
            )}
          </div>

          {/* Recent Logs */}
          {serverDiagnostics.recentLogs && serverDiagnostics.recentLogs.length > 0 && (
            <div className={styles.logsSection}>
              <h5 className={styles.subSectionTitle}>
                <Clock size={14} />
                Recent Server Logs
              </h5>
              <div className={styles.logsList}>
                {serverDiagnostics.recentLogs.slice(0, 10).map((log: LogEntry, index: number) => (
                  <div key={index} className={`${styles.logEntry} ${styles[`log${log.level}`]}`}>
                    <span className={styles.logTime}>{formatTimestamp(log.timestamp)}</span>
                    <span className={styles.logLevel}>[{log.level}]</span>
                    <span className={styles.logMessage}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Errors */}
          {serverDiagnostics.recentErrors && serverDiagnostics.recentErrors.length > 0 && (
            <div className={styles.errorsSection}>
              <h5 className={styles.subSectionTitle} style={{ color: 'var(--color-material-red-500)' }}>
                <AlertCircle size={14} />
                Recent Errors ({serverDiagnostics.recentErrors.length})
              </h5>
              <div className={styles.errorsList}>
                {serverDiagnostics.recentErrors.slice(0, 5).map((error: RecentError, index: number) => (
                  <div key={index} className={styles.errorEntry}>
                    <div className={styles.errorHeader}>
                      <span className={styles.errorTime}>{formatTimestamp(error.timestamp)}</span>
                      <span className={styles.errorType}>{error.errorType}</span>
                    </div>
                    <div className={styles.errorDetails}>
                      <span>
                        {error.clientType} client from {error.country}
                      </span>
                      <span className={styles.errorMessage}>{error.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-refresh toggle */}
          <div className={styles.row} style={{ marginTop: '12px' }}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh every 5s
            </label>
            <span className={styles.timestamp}>Updated: {formatTimestamp(serverDiagnostics.timestamp)}</span>
          </div>
        </>
      )}
    </div>
  );
}
