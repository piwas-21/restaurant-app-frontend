'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CONNECTION_STATUS_META, normalizeConnectionState, type ConnectionStateInput } from '@/lib/operationalStatus';
import styles from './StaffWorkspaceStatus.module.css';

export interface ConnectionStateBannerProps {
  state: ConnectionStateInput;
  lastConfirmed?: Date | string | null;
  error?: ReactNode;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

function formatLastConfirmed(value: Date | string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale || 'en');
}

export default function ConnectionStateBanner({
  state,
  lastConfirmed,
  error,
  onRetry,
  compact = false,
  className,
}: Readonly<ConnectionStateBannerProps>) {
  const { t, i18n } = useTranslation();
  const canonicalState = normalizeConnectionState(state);
  const meta = CONNECTION_STATUS_META[canonicalState];
  const label = t(meta.i18nKey);
  const last = formatLastConfirmed(lastConfirmed, i18n.language);

  return (
    <div
      className={[styles.connection, className].filter(Boolean).join(' ')}
      data-tone={meta.tone}
      data-state={canonicalState}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
      {!compact && last && (
        <span className={styles.lastConfirmed}>
          {t('server.last_confirmed', 'Last confirmed')}: {last}
        </span>
      )}
      {error && <span className={styles.error}>{error}</span>}
      {onRetry && canonicalState !== 'connected' && (
        <button type="button" className={styles.iconButton} onClick={onRetry} aria-label={t('retry', 'Retry')}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
