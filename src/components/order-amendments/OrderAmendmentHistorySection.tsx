'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useOrderAmendmentTranslations } from '@/hooks/orderAmendments/useOrderAmendmentTranslations';
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
  const translations = useOrderAmendmentTranslations(orderAmendmentsV1);
  const requestKey = `${orderId}:${refreshKey}`;
  const [view, setView] = useState<HistoryView | null>(null);

  useEffect(() => {
    if (!orderAmendmentsV1 || !translations.ready) return;
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
  }, [orderAmendmentsV1, orderId, requestKey, translations.ready]);

  if (!orderAmendmentsV1) return null;
  if (!translations.ready) {
    return (
      <section className={styles.section}>
        <output className={styles.state} aria-live="polite" aria-atomic="true">
          {translations.failed
            ? t('error_unexpected', 'Amendment history language could not be loaded. Please try again.')
            : t('common.loading', 'Loading…')}
        </output>
        {translations.failed && (
          <button type="button" className={styles.retry} onClick={translations.retry}>
            {t('retry', 'Retry')}
          </button>
        )}
      </section>
    );
  }
  const current = view?.key === requestKey ? view : null;
  let historyContent: ReactNode;
  if (!current) {
    historyContent = (
      <output className={styles.state} aria-live="polite" aria-atomic="true">
        {t('orderAmendments.history_loading', 'Loading amendment history…')}
      </output>
    );
  } else if (current.error) {
    historyContent = (
      <p className={styles.error} role="alert">
        {t('orderAmendments.history_unavailable', 'Amendment history could not be loaded.')}
      </p>
    );
  } else if (current.records.length === 0) {
    historyContent = (
      <p className={styles.state} role="note">
        {t('orderAmendments.history_empty', 'No committed amendments are recorded for this order.')}
      </p>
    );
  } else {
    historyContent = (
      <ol className={styles.records}>
        {current.records.map((record) => (
          <OrderAmendmentHistoryRecord key={record.amendmentId} record={record} language={i18n.language} />
        ))}
      </ol>
    );
  }
  return (
    <section className={styles.section} aria-label={t('orderAmendments.history_title', 'Amendment history')}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>{t('orderAmendments.history_title', 'Amendment history')}</span>
          {current && !current.error && <span className={styles.count}>{current.records.length}</span>}
        </summary>
        <div className={styles.content}>{historyContent}</div>
      </details>
    </section>
  );
}
