'use client';

import { useTranslation } from 'react-i18next';
import { X, Monitor } from 'lucide-react';
import styles from './CashierDiagnostics.module.css';
import RealtimeConnectionSection from './diagnostics/RealtimeConnectionSection';
import ServerDiagnosticsSection from './diagnostics/ServerDiagnosticsSection';
import AudioStatusSection from './diagnostics/AudioStatusSection';
import DiagnosticsTips from './diagnostics/DiagnosticsTips';

interface CashierDiagnosticsProps {
  // SSE Connection diagnostics
  sseConnected: boolean;
  sseConnectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  sseLastEventTime: Date | null;
  sseError: string | null;

  // Audio diagnostics
  audioEnabled: boolean;
  audioReady: boolean;
  audioBlockedByPolicy: boolean;

  // Actions
  onTestSound: () => void;
  onEnableAudio: () => void;
  onRefreshConnection: () => void;
  onClose?: () => void;
}

/**
 * Cashier diagnostics panel. Orchestrates four presentational sections
 * (real-time connection, server diagnostics, audio status, tips) plus the
 * header and environment-info card. `sseConnected` is part of the public
 * props contract (passed by CashierAuxiliaryDialogs) but intentionally
 * unused — the live state is derived from `sseConnectionState`.
 */
export default function CashierDiagnostics({
  sseConnected: _sseConnected,
  sseConnectionState,
  sseLastEventTime,
  sseError,
  audioEnabled,
  audioReady,
  audioBlockedByPolicy,
  onTestSound,
  onEnableAudio,
  onRefreshConnection,
  onClose,
}: CashierDiagnosticsProps) {
  const { t } = useTranslation();

  const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win');

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <h3>
          <Monitor size={18} />
          {t('diagnostics') || 'Diagnostics'}
        </h3>
        {onClose && (
          <button onClick={onClose} className={styles.closeButton} title="Close">
            <X size={20} />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {/* Environment Info */}
        <div className={styles.infoCard}>
          <div className={styles.row}>
            <span className={styles.label}>{t('environment') || 'Environment'}</span>
            <span className={styles.value}>
              {isFirefox ? 'Firefox' : 'Browser'} / {isWindows ? 'Windows' : 'OS'}
            </span>
          </div>
        </div>

        <RealtimeConnectionSection
          sseConnectionState={sseConnectionState}
          sseLastEventTime={sseLastEventTime}
          sseError={sseError}
          onRefreshConnection={onRefreshConnection}
        />

        <ServerDiagnosticsSection />

        <AudioStatusSection
          audioEnabled={audioEnabled}
          audioReady={audioReady}
          audioBlockedByPolicy={audioBlockedByPolicy}
          onEnableAudio={onEnableAudio}
          onTestSound={onTestSound}
        />

        <DiagnosticsTips audioBlockedByPolicy={audioBlockedByPolicy} sseConnectionState={sseConnectionState} />
      </div>
    </div>
  );
}
