'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';
import OrderAmendmentHistoryRecord from './OrderAmendmentHistoryRecord';
import styles from './OrderAmendmentHistorySection.module.css';

interface OrderAmendmentHistorySectionProps {
  readonly orderId: string;
  readonly refreshKey: string | number;
}

interface HistoryView {
  readonly key: string;
  readonly records: OrderAmendmentHistory[];
  readonly error: boolean;
}

export default function OrderAmendmentHistorySection({
  orderId,
  refreshKey,
}: Readonly<OrderAmendmentHistorySectionProps>) {
  const { t, i18n } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const requestKey = `${orderId}:${refreshKey}`;
  const [view, setView] = useState<HistoryView | null>(null);

  useEffect(() => {
    if (!orderAmendmentsV1) return;
    let active = true;
    void getOrderAmendmentHistory(orderId)
      .then((records) => {
        if (active) {
          setView({
            key: requestKey,
            records: records.filter((record) => record.state.toLowerCase() === 'committed'),
            error: false,
          });
        }
      })
      .catch(() => {
        if (active) setView({ key: requestKey, records: [], error: true });
      });
    return () => {
      active = false;
    };
  }, [orderAmendmentsV1, orderId, requestKey]);

  if (!orderAmendmentsV1) return null;
  const current = view?.key === requestKey ? view : null;
  return (
    <section className={styles.section} aria-label={t('orderAmendments.history_title', 'Amendment history')}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>{t('orderAmendments.history_title', 'Amendment history')}</span>
          {current && !current.error && <span className={styles.count}>{current.records.length}</span>}
        </summary>
        <div className={styles.content}>
          {!current ? (
            <p className={styles.state} role="status">
              {t('orderAmendments.history_loading', 'Loading amendment history…')}
            </p>
          ) : current.error ? (
            <p className={styles.error} role="alert">
              {t('orderAmendments.history_unavailable', 'Amendment history could not be loaded.')}
            </p>
          ) : current.records.length === 0 ? (
            <p className={styles.state} role="note">
              {t('orderAmendments.history_empty', 'No committed amendments are recorded for this order.')}
            </p>
          ) : (
            <ol className={styles.records}>
              {current.records.map((record) => (
                <OrderAmendmentHistoryRecord key={record.amendmentId} record={record} language={i18n.language} />
              ))}
            </ol>
          )}
        </div>
      </details>
    </section>
  );
}
