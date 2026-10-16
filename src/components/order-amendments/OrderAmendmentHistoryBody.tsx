'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useOrderAmendmentTranslations } from '@/hooks/orderAmendments/useOrderAmendmentTranslations';
import type { OrderDto } from '@/types/order';
import OrderRoundHistoryRecord from './OrderRoundHistoryRecord';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import { getOrderAmendmentHistory } from '@/services/orderAmendmentsService';
import OrderAmendmentHistoryRecord from './OrderAmendmentHistoryRecord';
import styles from './OrderAmendmentHistorySection.module.css';

interface OrderAmendmentHistorySectionProps {
  readonly orderId: string;
  readonly relatedOrders?: readonly OrderDto[];
  readonly onSelectOrder?: (orderId: string) => void;
  readonly refreshKey: string | number;
}

interface HistoryView {
  readonly key: string;
  readonly records: OrderAmendmentHistory[];
  readonly error: boolean;
}

export default function OrderAmendmentHistoryBody({
  orderId,
  refreshKey,
  relatedOrders,
  onSelectOrder,
}: Readonly<OrderAmendmentHistorySectionProps>) {
  const { t, i18n } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const translations = useOrderAmendmentTranslations(orderAmendmentsV1 || (relatedOrders?.length ?? 0) > 1);
  const includeGroup = (relatedOrders?.length ?? 0) > 1;
  const groupRevision = (relatedOrders ?? []).map((order) => `${order.id}:${order.version}`).join(',');
  const requestKey = `${orderId}:${includeGroup}:${groupRevision}:${refreshKey}`;
  const [view, setView] = useState<HistoryView | null>(null);

  useEffect(() => {
    if (!orderAmendmentsV1 || !translations.ready) return;
    let active = true;
    void (includeGroup ? getOrderAmendmentHistory(orderId, true) : getOrderAmendmentHistory(orderId))
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
  }, [orderAmendmentsV1, orderId, includeGroup, requestKey, translations.ready]);

  if (!orderAmendmentsV1 && (relatedOrders?.length ?? 0) <= 1) return null;
  const current = view?.key === requestKey ? view : null;
  const supplementIds = new Set(current?.records.map((record) => record.supplementOrderId).filter(Boolean));
  const rounds = (relatedOrders ?? []).slice(1).filter((order) => !supplementIds.has(order.id));
  let historyContent: ReactNode;
  if (!orderAmendmentsV1) {
    historyContent = null;
  } else if (!translations.ready) {
    historyContent = translations.failed ? (
      <div role="alert" className={styles.error}>
        <p>{t('error_unexpected')}</p>
        <button type="button" className={styles.retry} onClick={translations.retry}>
          {t('retry', 'Retry')}
        </button>
      </div>
    ) : (
      <output className={styles.state}>{t('loading', 'Loading…')}</output>
    );
  } else if (!current) {
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
  } else if (current.records.length === 0 && rounds.length === 0) {
    historyContent = (
      <p className={styles.state} role="note">
        {t('orderAmendments.history_empty', 'No committed amendments are recorded for this order.')}
      </p>
    );
  } else {
    historyContent = (
      <ol className={styles.records}>
        {current.records.map((record) => (
          <OrderAmendmentHistoryRecord
            key={record.amendmentId}
            record={record}
            language={i18n.language}
            onSelectOrder={onSelectOrder}
          />
        ))}
      </ol>
    );
  }
  return (
    <section className={styles.section} aria-label={t('orderAmendments.history_title', 'Amendment history')}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>{t('orderAmendments.history_title', 'Amendment history')}</span>
          {current && !current.error && <span className={styles.count}>{current.records.length + rounds.length}</span>}
        </summary>
        <div className={styles.content}>
          {rounds.length > 0 && (
            <ol className={styles.records}>
              {rounds.map((order) => (
                <OrderRoundHistoryRecord key={order.id} order={order} onSelectOrder={onSelectOrder} />
              ))}
            </ol>
          )}
          {historyContent}
        </div>
      </details>
    </section>
  );
}
