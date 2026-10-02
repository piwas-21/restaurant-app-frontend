'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrders } from '@/services/orderService';
import { routeApiError } from '@/utils/apiFormErrors';
import styles from './MarketplacePendingInbox.module.css';

const REFRESH_MS = 15_000;

interface Props {
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly onClear: () => void;
}

export default function MarketplacePendingInbox({ active, onSelect, onClear }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getOrders({
        scope: 'Operational',
        marketplaceOnly: true,
        status: 'PendingApproval',
        page: 1,
        pageSize: 1,
      });
      setCount(Number.isFinite(result.totalCount) ? result.totalCount : result.items.length);
      setFailed(false);
      setErrorMessage(null);
    } catch (cause) {
      setFailed(true);
      setErrorMessage(routeApiError(cause).rootMessage ?? t('marketplaceStaff.pending_unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (!loading && count === 0 && !failed) return null;

  const label =
    loading && count === null
      ? t('marketplaceStaff.pending_loading')
      : count === null
        ? t('marketplaceStaff.pending_unavailable')
        : active
          ? t('marketplaceStaff.pending_active', { count })
          : t('marketplaceStaff.pending_count', { count });

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${active ? styles.active : ''}`}
        aria-pressed={active}
        aria-busy={loading && count === null}
        onClick={active ? onClear : onSelect}
      >
        <span className={styles.label}>{label}</span>
        {count !== null && <span className={styles.count}>{count}</span>}
      </button>
      {failed && (
        <span className={styles.stale} role="status">
          {errorMessage ?? t('marketplaceStaff.pending_stale')}
        </span>
      )}
    </div>
  );
}
