'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import { TABLE_SERVICE_STATUS_META, type TableServiceState } from '@/lib/operationalStatus';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './StaffWorkspaceControls.module.css';

export interface TableServiceStripProps {
  tableLabel: string;
  state: TableServiceState;
  elapsedMinutes?: number | null;
  readyAgeMinutes?: number | null;
  balance?: number | null;
  trailing?: ReactNode;
  className?: string;
}

function metric(label: string, value: ReactNode) {
  return (
    <span className={styles.metric}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </span>
  );
}

export default function TableServiceStrip({
  tableLabel,
  state,
  elapsedMinutes,
  readyAgeMinutes,
  balance,
  trailing,
  className,
}: Readonly<TableServiceStripProps>) {
  const { t } = useTranslation();
  const status = TABLE_SERVICE_STATUS_META[state];
  const stateLabel = t(status.i18nKey);
  const tableText = `${t('table', 'Table')} ${tableLabel}`;
  const metrics = [
    elapsedMinutes != null ? `${t('minutes', 'Minutes')}: ${elapsedMinutes}` : null,
    readyAgeMinutes != null ? `${t('server.status_ready', 'Ready')}: ${readyAgeMinutes}` : null,
    balance != null ? `${t('cashier.remaining', 'Remaining')}: ${formatPlainCurrency(balance)}` : null,
  ].filter((metric): metric is string => Boolean(metric));

  return (
    <section
      className={[styles.strip, className].filter(Boolean).join(' ')}
      aria-label={[tableText, stateLabel, ...metrics].join(', ')}
    >
      <div className={styles.stripMeta}>
        <strong dir="auto">{tableText}</strong>
        <StatusBadge tone={status.tone} ariaLabel={stateLabel}>
          {stateLabel}
        </StatusBadge>
        {elapsedMinutes != null && metric(t('minutes', 'Minutes'), `${elapsedMinutes} ${t('minutes', 'minutes')}`)}
        {readyAgeMinutes != null &&
          metric(t('server.status_ready', 'Ready'), `${readyAgeMinutes} ${t('minutes', 'minutes')}`)}
        {balance != null && metric(t('cashier.remaining', 'Remaining'), formatPlainCurrency(balance))}
      </div>
      {trailing}
    </section>
  );
}
