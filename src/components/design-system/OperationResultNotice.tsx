'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import { OPERATION_STATUS_META, type OperationState } from '@/lib/operationalStatus';
import styles from './StaffWorkspaceControls.module.css';

export interface OperationResultNoticeProps {
  state: OperationState;
  operationId?: string | null;
  message: ReactNode;
  onRetry?: () => void;
  onReconcile?: () => void;
  className?: string;
}

export default function OperationResultNotice({
  state,
  operationId,
  message,
  onRetry,
  onReconcile,
  className,
}: Readonly<OperationResultNoticeProps>) {
  const { t } = useTranslation();
  const meta = OPERATION_STATUS_META[state];
  const needsReconciliation = state === 'unknown';

  return (
    <div
      className={[styles.notice, className].filter(Boolean).join(' ')}
      data-tone={meta.tone}
      role="status"
      aria-live="polite"
    >
      <div className={styles.noticeContent}>
        <StatusBadge tone={meta.tone}>{t(meta.i18nKey)}</StatusBadge>
        <span dir="auto">{message}</span>
        {operationId && <span className={styles.operationId}>{operationId}</span>}
      </div>
      {(onRetry || (needsReconciliation && onReconcile)) && (
        <div className={styles.noticeActions}>
          {needsReconciliation && onReconcile && (
            <button type="button" className={styles.actionButton} onClick={onReconcile}>
              {t('staff.check_result', 'Check result')}
            </button>
          )}
          {onRetry && !needsReconciliation && (
            <button type="button" className={`${styles.actionButton} ${styles.primary}`} onClick={onRetry}>
              {t('retry', 'Retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
